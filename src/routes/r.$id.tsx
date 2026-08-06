import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ReportView } from "@/components/ReportView";
import { getSharedReport } from "@/lib/critic.functions";

export const Route = createFileRoute("/r/$id")({
  loader: ({ params }) => getSharedReport({ data: { id: params.id } }),
  head: ({ loaderData }) => {
    const title = loaderData?.report
      ? `${loaderData.report.siteTitle || loaderData.report.url} scored ${loaderData.report.overallScore}/100`
      : "Shared report — UXroast AI";
    const description = loaderData?.report
      ? loaderData.report.verdict
      : "A shared landing page critique from UXroast AI.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  errorComponent: () => <Fallback message="This report could not be loaded." />,
  notFoundComponent: () => <Fallback message="This report does not exist." />,
  component: SharedReport,
});

function Fallback({ message }: { message: string }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Report unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
      >
        Analyze a page
      </Link>
    </main>
  );
}

function SharedReport() {
  const data = Route.useLoaderData();

  if (!data) return <Fallback message="This report does not exist or was removed." />;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-12">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Analyze your own page
      </Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Shared {new Date(data.createdAt).toLocaleDateString()}
      </p>
      <div className="mt-4">
        <ReportView report={data.report} shareId={data.id} canShare={false} />
      </div>
    </main>
  );
}
