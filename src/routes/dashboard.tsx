import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, ScanSearch } from "lucide-react";

import { listRecentReports } from "@/lib/critic.functions";

const TITLE = "Dashboard — UXroast AI";
const DESCRIPTION =
  "Your recent landing page audits with timestamps, scores, and quick links to every full report.";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Dashboard,
});

function scoreTone(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 55) return "text-warning";
  return "text-destructive";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Dashboard() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["recent-reports"],
    queryFn: () => listRecentReports(),
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Recent analyses</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Every audit you've run, newest first — with its score and a quick link to the full report.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          <ScanSearch className="size-4" /> New analysis
        </Link>
      </header>

      <div className="mt-10">
        {isPending && (
          <div className="panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-accent" /> Loading your analyses…
          </div>
        )}

        {isError && (
          <div className="panel p-6 text-sm">
            <p className="font-medium text-destructive">Couldn't load your analyses</p>
            <p className="mt-1 text-muted-foreground">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
          </div>
        )}

        {data && data.length === 0 && (
          <div className="panel p-8 text-center">
            <h2 className="text-lg font-semibold tracking-tight">No analyses yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Run your first audit and it will show up here with its score and report link.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Analyze a page
            </Link>
          </div>
        )}

        {data && data.length > 0 && (
          <ul className="panel divide-y divide-border overflow-hidden">
            {data.map((item) => (
              <li key={item.id} className="flex items-center gap-4 p-4 sm:p-5">
                <div className="flex w-14 shrink-0 flex-col items-center">
                  <span className={`font-mono text-xl font-semibold tabular-nums ${scoreTone(item.score)}`}>
                    {item.score}
                  </span>
                  <span className="text-[10px] text-muted-foreground">/100</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.siteTitle || item.url}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{item.url}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                </div>
                <Link
                  to="/r/$id"
                  params={{ id: item.id }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-accent/50"
                >
                  View <ArrowUpRight className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
