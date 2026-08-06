import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Link2,
  Mail,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ScoreGauge } from "@/components/ScoreGauge";
import { shareReport } from "@/lib/critic.functions";
import { SECTION_META, reportToMarkdown, type CriticReport, type Section } from "@/lib/critic-types";
import { downloadReportPdf } from "@/lib/report-pdf";

const impactStyles: Record<string, string> = {
  high: "border-destructive/40 text-destructive",
  medium: "border-warning/40 text-warning",
  low: "border-border text-muted-foreground",
};

function SectionCard({
  label,
  blurb,
  section,
  index,
}: {
  label: string;
  blurb: string;
  section: Section;
  index: number;
}) {
  return (
    <section
      className="panel animate-rise p-6 sm:p-7"
      style={{ animationDelay: `${120 + index * 90}ms` }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{label}</h3>
          <p className="text-sm text-muted-foreground">{blurb}</p>
        </div>
        <div className="flex items-baseline gap-1 font-mono">
          <span className="text-2xl font-semibold tabular-nums">{section.score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </header>

      {section.summary && <p className="mt-5 text-sm leading-relaxed">{section.summary}</p>}

      {section.strengths.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            What works
          </h4>
          <ul className="mt-3 space-y-2">
            {section.strengths.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {section.issues.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            What to fix
          </h4>
          <ul className="mt-3 space-y-3">
            {section.issues.map((issue) => (
              <li key={issue.title + issue.detail} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                      impactStyles[issue.impact] ?? impactStyles['low']
                    }`}
                  >
                    {issue.impact}
                  </span>
                  <span className="text-sm font-medium">{issue.title}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{issue.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function ReportView({
  report,
  shareId,
  canShare = true,
}: {
  report: CriticReport;
  shareId?: string;
  canShare?: boolean;
}) {
  const share = useServerFn(shareReport);
  const [sharedId, setSharedId] = useState<string | undefined>(shareId);
  const [sharing, setSharing] = useState(false);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportToMarkdown(report));
      toast.success("Report copied to clipboard");
    } catch {
      toast.error("Clipboard access was blocked by your browser");
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const id = sharedId ?? (await share({ data: { report: report as unknown as Record<string, unknown> } })).id;
      setSharedId(id);
      const url = `${window.location.origin}/r/${id}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied", { description: url });
      } catch {
        toast.success("Share link ready", { description: url });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create a share link");
    } finally {
      setSharing(false);
    }
  };

  const handlePdf = async () => {
    try {
      await downloadReportPdf(report);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Could not generate the PDF");
    }
  };

  return (
    <div className="space-y-5">
      <div className="panel animate-rise overflow-hidden">
        <div className="flex flex-col gap-8 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-widest text-accent">Report</p>
            <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">
              {report.siteTitle || report.url}
            </h2>
            <a
              href={report.url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="truncate">{report.url}</span>
              <ArrowUpRight className="size-3.5 shrink-0" />
            </a>
            <p className="mt-4 max-w-xl text-sm leading-relaxed">{report.verdict}</p>
          </div>
          <div className="shrink-0 self-center">
            <ScoreGauge score={report.overallScore} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border bg-secondary/40 px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={copyReport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:border-accent/50"
          >
            <Copy className="size-4" /> Copy report
          </button>
          {canShare && (
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:border-accent/50 disabled:opacity-60"
            >
              <Link2 className="size-4" /> {sharing ? "Creating link…" : "Share report"}
            </button>
          )}
          <button
            type="button"
            onClick={handlePdf}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:border-accent/50"
          >
            <Download className="size-4" /> Download PDF
          </button>
        </div>
      </div>

      {report.thinContent && (
        <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="leading-relaxed">
            This page returned very little server-rendered content, so the critique is scoped to what
            was visible. Pages that render entirely in the browser give thinner results.
          </p>
        </div>
      )}

      {SECTION_META.map((meta, index) => (
        <SectionCard
          key={meta.key}
          label={meta.label}
          blurb={meta.blurb}
          section={report[meta.key]}
          index={index}
        />
      ))}

      <div className="panel animate-rise flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles className="size-4 text-accent" />
            Want me to implement these fixes?
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get the rewritten copy, redesigned sections, and shipped code.
          </p>
        </div>
        <a
          href={`mailto:vedabrandssupport@gmail.com?subject=${encodeURIComponent(
            `Implement fixes for ${report.url}`,
          )}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          <Mail className="size-4" /> Contact
        </a>
      </div>

      {sharedId && (
        <p className="text-center text-xs text-muted-foreground">
          Shareable link:{" "}
          <Link to="/r/$id" params={{ id: sharedId }} className="font-mono text-accent underline">
            /r/{sharedId}
          </Link>
        </p>
      )}
    </div>
  );
}
