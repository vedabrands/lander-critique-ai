import { normalizeReport, type CriticReport } from "./critic-types";

export type PageContent = {
  url: string;
  title: string;
  description: string;
  headings: { level: number; text: string }[];
  ctas: string[];
  text: string;
  imageCount: number;
  imagesMissingAlt: number;
  thinContent: boolean;
};

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function clean(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs can be analyzed.");
  }
  return parsed.toString();
}

export async function scrapePage(url: string): Promise<PageContent> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let html = "";
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; LandingPageCritic/1.0; +https://lovable.dev)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      throw new Error(
        `The site responded with status ${response.status}. It may block automated visits.`,
      );
    }
    html = await response.text();
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The site took too long to respond. Try again or use another URL.");
    }
    if (error instanceof Error && error.message.startsWith("The site responded")) throw error;
    throw new Error("Could not reach that URL. Check the address and try again.");
  }
  clearTimeout(timeout);

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const description = clean(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ?? "",
  );

  const headings: { level: number; text: string }[] = [];
  const headingRe = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(body)) && headings.length < 40) {
    const text = clean(match[2] ?? "");
    if (text) headings.push({ level: Number(match[1]), text: text.slice(0, 160) });
  }

  const ctas: string[] = [];
  const ctaRe = /<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/gi;
  while ((match = ctaRe.exec(body)) && ctas.length < 40) {
    const text = clean(match[1] ?? "");
    if (text && text.length <= 60 && !ctas.includes(text)) ctas.push(text);
  }

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesMissingAlt = imgTags.filter((tag) => !/\balt\s*=\s*["'][^"']+["']/i.test(tag)).length;

  const text = clean(body).slice(0, 9000);

  return {
    url,
    title,
    description,
    headings,
    ctas,
    text,
    imageCount: imgTags.length,
    imagesMissingAlt,
    thinContent: text.length < 400,
  };
}

const SYSTEM_PROMPT = `You are a senior conversion-rate strategist and product designer who has audited hundreds of SaaS landing pages.
You review the extracted content of one landing page and return a blunt, specific, actionable critique.
Rules:
- Be specific to the page's actual words and structure. Quote the real headline or CTA labels when relevant. Never invent content that is not present.
- No generic filler advice. Every issue must name the element and the fix.
- Scores are strict: 90+ is exceptional, 70-85 solid, 50-69 mediocre, below 50 broken.
- You only see server-rendered HTML. If content is thin, say so and scope your critique to what is visible.
Return ONLY a JSON object, no markdown fences, matching:
{
  "siteTitle": string,
  "verdict": string (one sharp sentence),
  "overallScore": number 0-100,
  "ui": { "score": number, "summary": string, "strengths": string[], "issues": [{ "title": string, "detail": string, "impact": "high"|"medium"|"low" }] },
  "copy": { same shape },
  "conversion": { same shape }
}
Give 2-4 strengths and 3-5 issues per section. Keep each detail under 320 characters.`;

function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  const candidate = (fenced ?? text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function analyzePage(page: PageContent): Promise<CriticReport> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("AI is not configured for this project yet.");

  const userPrompt = [
    `URL: ${page.url}`,
    `Title tag: ${page.title || "(missing)"}`,
    `Meta description: ${page.description || "(missing)"}`,
    `Headings:\n${
      page.headings.length
        ? page.headings.map((h) => `  H${h.level}: ${h.text}`).join("\n")
        : "  (none found)"
    }`,
    `Button / link labels: ${page.ctas.length ? page.ctas.join(" | ") : "(none found)"}`,
    `Images: ${page.imageCount} total, ${page.imagesMissingAlt} missing alt text`,
    page.thinContent
      ? "NOTE: very little server-rendered text was found; the page likely renders client-side."
      : "",
    `Visible page text:\n${page.text || "(empty)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[AI] gateway error ${response.status}: ${body}`);
    if (response.status === 429) {
      throw new Error("Too many analyses right now. Please wait a moment and try again.");
    }
    if (response.status === 402) {
      throw new Error("AI credits are exhausted. Add credits to keep analyzing pages.");
    }
    throw new Error("The analysis engine failed to respond. Please try again.");
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed) throw new Error("The analysis came back unreadable. Please try again.");

  return normalizeReport(parsed, {
    url: page.url,
    siteTitle: page.title || new URL(page.url).hostname,
    thinContent: page.thinContent,
  });
}
