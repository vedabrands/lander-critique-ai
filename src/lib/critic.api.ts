import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
import type { CriticReport, StoredReport } from "./critic-types";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ShareReportRequest,
  ShareReportResponse,
  FavoriteReportRequest,
  FavoriteReportResponse,
  ReportListResponse,
  AnalyticsResponse,
  BatchAnalyzeRequest,
  BatchAnalyzeResponse,
  CompareReportsRequest,
  CompareReportsResponse,
  ExtendedStoredReport,
} from "./api.server";

/**
 * VALIDATION SCHEMAS
 */
const UrlSchema = z.object({
  url: z.string().trim().min(3).max(2048).url("Invalid URL format"),
});

const UrlInputValidator = z.object({
  url: z.string().trim().min(3).max(2048),
});

const IdSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

const BatchUrlsSchema = z.object({
  urls: z.array(z.string().trim().min(3).max(2048)).min(1).max(10),
  notifyOnComplete: z.boolean().optional(),
});

const CompareIdsSchema = z.object({
  reportIds: z.array(z.string().uuid()).min(2).max(5),
});

const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

const TagsSchema = z.object({
  reportId: z.string().uuid(),
  tags: z.array(z.string().min(1).max(50)).max(10),
});

const NotesSchema = z.object({
  reportId: z.string().uuid(),
  notes: z.string().max(1000),
});

/**
 * CORE API: Analyze Landing Page (Enhanced)
 * POST /api/reports/analyze
 * Analyzes a landing page and stores the report
 */
export const analyzeAndStoreReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UrlInputValidator.parse(input))
  .handler(async ({ data }): Promise<AnalyzeResponse> => {
    const { normalizeUrl, scrapePage, analyzePage } = await import("./critic.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const url = normalizeUrl(data.url);
    const page = await scrapePage(url);
    const report = await analyzePage(page);

    // Store the report in database
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
      console.error("[analyzeAndStoreReport] insert failed", error);
      throw new Error("Could not store the report. Please try again.");
    }

    return {
      id: row.id as string,
      report,
      createdAt: row.created_at as string,
    };
  });

/**
 * CORE API: Share Report
 * POST /api/reports/share
 * Creates a shareable link for an existing report
 */
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

/**
 * CORE API: Get Shared Report
 * GET /api/reports/:id
 * Retrieves a publicly shared report
 */
export const getSharedReport = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => IdSchema.parse(input))
  .handler(async ({ data }): Promise<StoredReport | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
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

/**
 * API: Get All Reports (Paginated)
 * GET /api/reports?page=1&pageSize=20
 * Retrieves user's reports with pagination
 */
export const getAllReports = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => PaginationSchema.parse(input))
  .handler(async ({ data }): Promise<ReportListResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const page = data.page || 1;
    const pageSize = data.pageSize || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from("reports")
      .select("id", { count: "exact", head: true });

    if (countError) {
      console.error("[getAllReports] count failed", countError);
      throw new Error("Could not fetch reports count.");
    }

    // Get paginated data
    const { data: rows, error } = await supabaseAdmin
      .from("reports")
      .select("id, report, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[getAllReports] fetch failed", error);
      throw new Error("Could not fetch reports.");
    }

    const reports: StoredReport[] = (rows || []).map((row) => ({
      id: row.id as string,
      createdAt: row.created_at as string,
      report: row.report as unknown as CriticReport,
    }));

    return {
      reports,
      total: count || 0,
      page,
      pageSize,
    };
  });

/**
 * API: Favorite/Unfavorite Report
 * POST /api/reports/:id/favorite
 * Toggle favorite status for a report
 */
export const toggleFavoriteReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => IdSchema.parse(input))
  .handler(async ({ data }): Promise<FavoriteReportResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get current favorite status
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("reports")
      .select("favorited")
      .eq("id", data.id)
      .single();

    if (fetchError) {
      console.error("[toggleFavoriteReport] fetch failed", fetchError);
      throw new Error("Report not found.");
    }

    const currentStatus = (existing?.favorited as boolean) || false;
    const newStatus = !currentStatus;

    // Update favorite status
    const { error: updateError } = await supabaseAdmin
      .from("reports")
      .update({ favorited: newStatus, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (updateError) {
      console.error("[toggleFavoriteReport] update failed", updateError);
      throw new Error("Could not update favorite status.");
    }

    return {
      success: true,
      favorited: newStatus,
    };
  });

/**
 * API: Add Tags to Report
 * POST /api/reports/:id/tags
 * Add tags for better organization
 */
export const addTagsToReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TagsSchema.parse(input))
  .handler(async ({ data }): Promise<{ success: boolean; tags: string[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("reports")
      .update({
        tags: data.tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.reportId);

    if (error) {
      console.error("[addTagsToReport] update failed", error);
      throw new Error("Could not update tags.");
    }

    return {
      success: true,
      tags: data.tags,
    };
  });

/**
 * API: Add Notes to Report
 * POST /api/reports/:id/notes
 * Add personal notes to a report
 */
export const addNotesToReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => NotesSchema.parse(input))
  .handler(async ({ data }): Promise<{ success: boolean; notes: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("reports")
      .update({
        notes: data.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.reportId);

    if (error) {
      console.error("[addNotesToReport] update failed", error);
      throw new Error("Could not update notes.");
    }

    return {
      success: true,
      notes: data.notes,
    };
  });

/**
 * API: Compare Multiple Reports
 * POST /api/reports/compare
 * Compare scores and insights across multiple reports
 */
export const compareReports = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CompareIdsSchema.parse(input))
  .handler(async ({ data }): Promise<CompareReportsResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("reports")
      .select("id, report")
      .in("id", data.reportIds);

    if (error || !rows || rows.length === 0) {
      console.error("[compareReports] fetch failed", error);
      throw new Error("Could not fetch reports for comparison.");
    }

    const comparison = rows.map((row) => {
      const report = row.report as unknown as CriticReport;
      return {
        url: report.url,
        overallScore: report.overallScore,
        ui_score: report.ui.score,
        copy_score: report.copy.score,
        conversion_score: report.conversion.score,
        strengths: report.ui.strengths
          .concat(report.copy.strengths)
          .concat(report.conversion.strengths)
          .slice(0, 5),
        topIssues: report.ui.issues
          .concat(report.copy.issues)
          .concat(report.conversion.issues)
          .filter((i) => i.impact === "high")
          .slice(0, 3)
          .map((i) => i.title),
      };
    });

    const bestPerformer = comparison.reduce((best, current) =>
      current.overallScore > best.overallScore ? current : best
    );

    const insights = [
      `Best overall score: ${bestPerformer.url} (${bestPerformer.overallScore}/100)`,
      `Average score across all: ${Math.round(comparison.reduce((sum, c) => sum + c.overallScore, 0) / comparison.length)}/100`,
      `Common strengths: Consistent UI/UX and clear messaging patterns`,
    ];

    return {
      comparison,
      bestPerformer,
      winner: bestPerformer.url,
      insights,
    };
  });

/**
 * API: Batch Analyze URLs
 * POST /api/reports/batch-analyze
 * Analyze multiple URLs in sequence
 */
export const batchAnalyzeUrls = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BatchUrlsSchema.parse(input))
  .handler(async ({ data }): Promise<BatchAnalyzeResponse> => {
    const batchId = Math.random().toString(36).substring(7);
    const results: AnalyzeResponse[] = [];
    const pendingUrls: string[] = [];

    const { normalizeUrl, scrapePage, analyzePage } = await import("./critic.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (const urlString of data.urls) {
      try {
        const url = normalizeUrl(urlString);
        const page = await scrapePage(url);
        const report = await analyzePage(page);

        const { data: row, error } = await supabaseAdmin
          .from("reports")
          .insert({
            url: report.url.slice(0, 2048),
            site_title: (report.siteTitle ?? "").slice(0, 300),
            overall_score: Number(report.overallScore) || 0,
            report: report as unknown as Json,
            batch_id: batchId,
          })
          .select("id, created_at")
          .single();

        if (!error && row) {
          results.push({
            id: row.id as string,
            report,
            createdAt: row.created_at as string,
          });
        } else {
          pendingUrls.push(urlString);
        }
      } catch (err) {
        pendingUrls.push(urlString);
      }
    }

    return {
      batchId,
      totalUrls: data.urls.length,
      completedCount: results.length,
      pendingUrls,
      results,
    };
  });

/**
 * API: Get Analytics Summary
 * GET /api/reports/analytics/summary
 * Retrieve aggregated analytics across all reports
 */
export const getAnalyticsSummary = createServerFn({ method: "GET" })
  .handler(async (): Promise<AnalyticsResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("reports")
      .select("id, report, created_at")
      .order("overall_score", { ascending: false })
      .limit(100);

    if (error || !rows) {
      console.error("[getAnalyticsSummary] fetch failed", error);
      throw new Error("Could not fetch analytics.");
    }

    const totalAnalyses = rows.length;
    const scores = rows.map((r) => (r.report as unknown as CriticReport).overallScore);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const topScores = rows
      .slice(0, 5)
      .map((r) => {
        const report = r.report as unknown as CriticReport;
        return {
          url: report.url,
          score: report.overallScore,
        };
      });

    const commonIssues: Record<string, number> = {};
    rows.forEach((r) => {
      const report = r.report as unknown as CriticReport;
      report.ui.issues.forEach((issue) => {
        commonIssues[issue.title] = (commonIssues[issue.title] || 0) + 1;
      });
      report.copy.issues.forEach((issue) => {
        commonIssues[issue.title] = (commonIssues[issue.title] || 0) + 1;
      });
      report.conversion.issues.forEach((issue) => {
        commonIssues[issue.title] = (commonIssues[issue.title] || 0) + 1;
      });
    });

    return {
      totalAnalyses,
      averageScore,
      topScores,
      lastAnalysisDate: rows[0]?.created_at || new Date().toISOString(),
      commonIssues: Object.entries(commonIssues)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([title, count]) => ({ title, count })),
    };
  });

/**
 * API: Delete Report
 * DELETE /api/reports/:id
 * Remove a report from the database
 */
export const deleteReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => IdSchema.parse(input))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("reports").delete().eq("id", data.id);

    if (error) {
      console.error("[deleteReport] delete failed", error);
      throw new Error("Could not delete the report.");
    }

    return { success: true };
  });
