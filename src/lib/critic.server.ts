import { normalizeReport, type CriticReport } from "./critic-types";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

export type ScrapedPage = {
  url: string;
  title: string;
  description: string;
  headings: string[];
  ctas: string[];
  text: string;
  thinContent: boolean;
};

/** Adds a protocol when missing and rejects anything that isn't public http(s). */
export function normalizeUrl(input: string): string {
  const raw = input.trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs can be analyzed.");
  }
  const host = parsed.hostname.toLowerCase();
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isLocal) throw new Error("Private and local addresses can't be analyzed.");
  if (!host.includes(".")) throw new Error("That doesn't look like a valid domain.");
  return parsed.toString();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function matchAll(html: string, pattern: RegExp): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(pattern)) {
    const value = stripTags(match[1] ?? "");
    if (value) out.push(value);
  }
  return out;
}

/** Fetches a page and extracts the signals the critique needs. */
export async function scrapePage(url: string): Promise<ScrapedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; UXroastAI/1.0; +https://uxroast.lovable.app) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch {
    throw new Error("Could not reach that page. Check the URL and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`The page responded with ${response.status}. Try a different URL.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("html") && !contentType.includes("text")) {
    throw new Error("That URL doesn't return an HTML page.");
  }

  const html = (await response.text()).slice(0, 500_000);

  const title =
    stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") ||
    new URL(url).hostname;

  const description =
    html.match(
      /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
    )?.[1] ??
    html.match(
      /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i,
    )?.[1] ??
    "";

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  const headings = [
    ...matchAll(body, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map((h) => `H1: ${h}`),
    ...matchAll(body, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map((h) => `H2: ${h}`),
    ...matchAll(body, /<h3[^>]*>([\s\S]*?)<\/h3>/gi).map((h) => `H3: ${h}`),
  ].slice(0, 40);

  const ctas = Array.from(
    new Set([
      ...matchAll(body, /<button[^>]*>([\s\S]*?)<\/button>/gi),
      ...matchAll(body, /<a[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi),
    ]),
  )
    .filter((label) => label.length > 1 && label.length < 60)
    .slice(0, 20);

  const text = stripTags(body).slice(0, 12_000);

  return {
    url,
    title: decodeEntities(title).slice(0, 300),
    description: decodeEntities(description).slice(0, 500),
    headings,
    ctas,
    text,
    thinContent: text.length < 400,
  };
}

const SYSTEM_PROMPT = `You are a blunt, senior landing page strategist who combines product design, conversion copywriting, and growth experimentation.
You audit a single landing page from its extracted content and return strictly valid JSON.
Be specific and concrete: reference the page's actual headline, CTAs, and sections. No generic advice, no filler, no markdown.
Scores are integers 0-100 and must be honest: 40-60 is average, above 85 is exceptional.
Return JSON with exactly this shape:
{
  "siteTitle": string,
  "verdict": string (2-3 sentences, direct),
  "overallScore": number,
  "ui": { "score": number, "summary": string, "strengths": string[], "issues": [{ "title": string, "detail": string, "impact": "high"|"medium"|"low" }] },
  "copy": { same shape as ui },
  "conversion": { same shape as ui }
}
Give 2-4 strengths and 3-5 issues per section. Each issue detail says exactly what to change.`;

function buildUserPrompt(page: ScrapedPage): string {
  return [
    `URL: ${page.url}`,
    `Title: ${page.title}`,
    `Meta description: ${page.description || "(none)"}`,
    `Headings:\n${page.headings.length ? page.headings.join("\n") : "(none found)"}`,
    `Button / CTA labels: ${page.ctas.length ? page.ctas.join(" | ") : "(none found)"}`,
    page.thinContent
      ? "NOTE: this page returned very little server-rendered content. Scope the critique to what is visible and flag the thin content as a discoverability risk."
      : "",
    `Visible text (truncated):\n${page.text}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function extractJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error("The analysis came back malformed. Please try again.");
  }
}

/** Sends the scraped page to Lovable AI and normalizes the critique. */
export async function analyzePage(page: ScrapedPage): Promise<CriticReport> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project.");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(page) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[analyzePage] gateway failed [${response.status}]: ${body}`);
    if (response.status === 429) {
      throw new Error("Too many analyses right now. Please wait a moment and try again.");
    }
    if (response.status === 402) {
      throw new Error("AI credits are exhausted. Add credits to keep analyzing pages.");
    }
    throw new Error("The AI analysis failed. Please try again.");
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The AI analysis returned nothing. Please try again.");

  return normalizeReport(extractJson(content), {
    url: page.url,
    siteTitle: page.title,
    thinContent: page.thinContent,
  });
}
