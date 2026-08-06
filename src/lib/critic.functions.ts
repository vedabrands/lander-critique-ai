import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
import type { CriticReport, StoredReport } from "./critic-types";

const UrlInput = z.object({ url: z.string().trim().min(3).max(2048) });
const IdInput = z.object({ id: z.string().uuid() });

export const analyzeLandingPage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UrlInput.parse(input))
  .handler(async ({ data }): Promise<StoredReport> => {
    const { normalizeUrl, scrapePage, analyzePage } = await import("./critic.server");
    const url = normalizeUrl(data.url);
    const page = await scrapePage(url);
    const report = await analyzePage(page);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("reports")
      .insert({
        url: report.url.slice(0, 2048),
        site_title: (report.siteTitle ?? "").slice(0, 300),
        overall_score: Number(report.overallScore) || 0,
        report: report as unknown as Json,
      })
      .select("id, created_at")
      .single();

    if (error || !row) {
      console.error("[analyzeLandingPage] insert failed", error);
      return { id: "", createdAt: new Date().toISOString(), report };
    }

    return { id: row.id, createdAt: row.created_at, report };
  });

export const listRecentReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<{ id: string; url: string; siteTitle: string; score: number; createdAt: string }>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("reports")
      .select("id, url, site_title, overall_score, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[listRecentReports] read failed", error);
      throw new Error("Could not load your recent analyses.");
    }

    return (rows ?? []).map((row) => ({
      id: row.id,
      url: row.url,
      siteTitle: row.site_title ?? "",
      score: row.overall_score ?? 0,
      createdAt: row.created_at,
    }));
  },
);

export const shareReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        report: z.record(z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ id: string }> => {
    const report = data.report as unknown as CriticReport;
    if (typeof report?.url !== "string") throw new Error("Invalid report payload.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("reports")
      .insert({
        url: report.url.slice(0, 2048),
        site_title: (report.siteTitle ?? "").slice(0, 300),
        overall_score: Number(report.overallScore) || 0,
        report: report as unknown as Json,
      })
      .select("id")
      .single();

    if (error || !row) {
      console.error("[shareReport] insert failed", error);
      throw new Error("Could not create a share link. Please try again.");
    }
    return { id: row.id };
  });

export const getSharedReport = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }): Promise<StoredReport | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
    const client = createClient(process.env['SUPABASE_URL']!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: row, error } = await client
      .from("reports")
      .select("id, report, created_at")
      .eq("id", data.id)
      .maybeSingle();

    if (error) {
      console.error("[getSharedReport] read failed", error);
      return null;
    }
    if (!row) return null;

    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      report: row.report as unknown as CriticReport,
    };
  });
