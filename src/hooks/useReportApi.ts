import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reportApi } from "@/lib/api-client";
import type { AnalyzeResponse, ReportListResponse, AnalyticsResponse, CompareReportsResponse } from "@/lib/api.server";

/**
 * Hook for analyzing a landing page
 */
export function useAnalyzeReport() {
  return useMutation({
    mutationFn: (url: string) => reportApi.analyze(url),
    meta: {
      errorMessage: "Failed to analyze the landing page. Please try again.",
    },
  });
}

/**
 * Hook for fetching all reports
 */
export function useReports(page: number = 1, pageSize: number = 20) {
  return useQuery<ReportListResponse>({
    queryKey: ["reports", page, pageSize],
    queryFn: () => reportApi.getAllReports(page, pageSize),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for fetching a specific shared report
 */
export function useSharedReport(id: string) {
  return useQuery({
    queryKey: ["report", id],
    queryFn: () => reportApi.getSharedReport(id),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook for toggling favorite status
 */
export function useFavoriteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => reportApi.toggleFavorite(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    meta: {
      errorMessage: "Failed to update favorite status.",
    },
  });
}

/**
 * Hook for adding tags
 */
export function useAddTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, tags }: { reportId: string; tags: string[] }) =>
      reportApi.addTags(reportId, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    meta: {
      errorMessage: "Failed to add tags.",
    },
  });
}

/**
 * Hook for adding notes
 */
export function useAddNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, notes }: { reportId: string; notes: string }) =>
      reportApi.addNotes(reportId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    meta: {
      errorMessage: "Failed to save notes.",
    },
  });
}

/**
 * Hook for comparing reports
 */
export function useCompareReports(reportIds: string[]) {
  return useMutation({
    mutationFn: () => reportApi.compareReports(reportIds),
    meta: {
      errorMessage: "Failed to compare reports.",
    },
  });
}

/**
 * Hook for batch analyzing URLs
 */
export function useBatchAnalyze() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (urls: string[]) => reportApi.batchAnalyze(urls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    meta: {
      errorMessage: "Batch analysis failed. Some URLs may not have been analyzed.",
    },
  });
}

/**
 * Hook for fetching analytics
 */
export function useAnalytics() {
  return useQuery<AnalyticsResponse>({
    queryKey: ["analytics"],
    queryFn: () => reportApi.getAnalytics(),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Hook for deleting a report
 */
export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => reportApi.deleteReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    meta: {
      errorMessage: "Failed to delete the report.",
    },
  });
}
