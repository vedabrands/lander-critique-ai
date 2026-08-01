import type { Json } from "@/integrations/supabase/types";
import type { CriticReport, StoredReport } from "./critic-types";

/**
 * API Server Functions
 * Core REST API endpoints for the Landing Page Critic service
 * 
 * Endpoints:
 * - POST /api/reports/analyze - Analyze a landing page
 * - POST /api/reports/share - Create a shareable report link
 * - GET /api/reports/:id - Retrieve a shared report
 * - GET /api/reports - List all user reports (with auth)
 * - POST /api/reports/:id/favorite - Add report to favorites
 * - DELETE /api/reports/:id/favorite - Remove from favorites
 * - GET /api/analytics/summary - Get analysis statistics
 */

export interface AnalyzeRequest {
  url: string;
}

export interface AnalyzeResponse {
  id: string;
  report: CriticReport;
  createdAt: string;
}

export interface ShareReportRequest {
  reportId: string;
  includeAnalysis: boolean;
}

export interface ShareReportResponse {
  id: string;
  url: string;
  createdAt: string;
}

export interface FavoriteReportRequest {
  reportId: string;
}

export interface FavoriteReportResponse {
  success: boolean;
  favorited: boolean;
}

export interface ReportListResponse {
  reports: StoredReport[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AnalyticsResponse {
  totalAnalyses: number;
  averageScore: number;
  topScores: Array<{
    url: string;
    score: number;
  }>;
  lastAnalysisDate: string;
  commonIssues: Array<{
    title: string;
    count: number;
  }>;
}

/**
 * Enhanced Report Storage Type
 * Extends the basic report with metadata for tracking and analytics
 */
export interface ExtendedStoredReport extends StoredReport {
  favorited?: boolean;
  viewCount?: number;
  shareCount?: number;
  tags?: string[];
  notes?: string;
  lastViewedAt?: string;
}

/**
 * Batch Analysis Request
 * For analyzing multiple URLs in one request
 */
export interface BatchAnalyzeRequest {
  urls: string[];
  notifyOnComplete?: boolean;
}

export interface BatchAnalyzeResponse {
  batchId: string;
  totalUrls: number;
  completedCount: number;
  pendingUrls: string[];
  results: AnalyzeResponse[];
}

/**
 * Comparison Request
 * For comparing two or more landing pages
 */
export interface CompareReportsRequest {
  reportIds: string[];
}

export interface ComparisonMetrics {
  url: string;
  overallScore: number;
  ui_score: number;
  copy_score: number;
  conversion_score: number;
  strengths: string[];
  topIssues: string[];
}

export interface CompareReportsResponse {
  comparison: ComparisonMetrics[];
  bestPerformer: ComparisonMetrics;
  winner: string;
  insights: string[];
}

/**
 * Helper function to construct API URLs
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : process.env.VITE_API_URL || "";
  return `${baseUrl}/api${endpoint}`;
}

/**
 * Fetch wrapper with error handling
 */
export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = getApiUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
