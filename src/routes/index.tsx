import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Gauge, Loader2, ScanSearch, Wand2 } from "lucide-react";
import { useState } from "react";

import { ReportView } from "@/components/ReportView";
import { analyzeLandingPage } from "@/lib/critic.functions";
import type { CriticReport } from "@/lib/critic-types";

const DEMO_URL = "https://stripe.com";

const TITLE = "Landing Page Critic — AI audit of your landing page";
const DESCRIPTION =
  "Paste any URL and get an instant expert critique of your landing page: UI/UX, copywriting, conversion fixes, and a score out of 100.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Home,
});

const STEPS = [
  { icon: ScanSearch, label: "Fetching the page" },
  { icon: Gauge, label: "Reading structure and copy" },
  { icon: Wand2, label: "Writing the critique" },
];

function AnalyzingPanel({ url }: { url: string }) {
  return (
    <div className="panel animate-rise p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Loader2 className="size-4 animate-spin text-accent" />
        <p className="truncate font-mono text-sm text-muted-foreground">{url}</p>
      </div>
      <div className="mt-6 space-y-3">
        {STEPS.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3 text-sm">
            <step.icon className="size-4 text-accent" />
            <span className="text-muted-foreground">{step.label}</span>
            <div className="relative ml-auto h-1 w-28 overflow-hidden rounded-full bg-secondary">
              <div
                className="animate-sweep absolute inset-y-0 w-1/2 rounded-full bg-accent"
                style={{ animationDelay: `${index * 220}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-3">
        {[92, 76, 84, 60].map((width, index) => (
          <div
            key={width}
            className="h-3 animate-pulse rounded-full bg-secondary"
            style={{ width: `${width}%`, animationDelay: `${index * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function Home() {
  const [url, setUrl] = useState("");
  const analyze = useServerFn(analyzeLandingPage);

  const mutation = useMutation<CriticReport, Error, string>({
    mutationFn: (value) => analyze({ data: { url: value } }),
  });

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setUrl(trimmed);
    mutation.mutate(trimmed);
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px]">
        <div className="hero-glow absolute inset-0" />
        <div className="grid-lines absolute inset-0 opacity-60" />
      </div>

      <main className="relative mx-auto w-full max-w-3xl px-5 pb-24 pt-14 sm:pt-20">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-accent" />
            AI landing page audits
          </span>
          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Find out why your landing page isn't converting.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            Paste a URL. Get a blunt expert critique of the design, the copy, and the conversion path —
            with a score out of 100 and the exact fixes to ship next.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(url);
          }}
          className="panel mt-10 flex flex-col gap-2 p-2 sm:flex-row sm:items-center"
        >
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            inputMode="url"
            maxLength={2048}
            placeholder="yourcompany.com"
            aria-label="Landing page URL"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={mutation.isPending || !url.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Analyzing
              </>
            ) : (
              <>
                Analyze <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>No signup required.</span>
          <button
            type="button"
            onClick={() => submit(DEMO_URL)}
            disabled={mutation.isPending}
            className="font-mono text-accent underline underline-offset-4 disabled:opacity-50"
          >
            Try the demo → {DEMO_URL.replace("https://", "")}
          </button>
        </div>

        <div className="mt-12">
          {mutation.isPending && <AnalyzingPanel url={url} />}

          {mutation.isError && !mutation.isPending && (
            <div className="panel animate-rise p-6 text-sm">
              <p className="font-medium text-destructive">Analysis failed</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">{mutation.error.message}</p>
            </div>
          )}

          {mutation.isSuccess && !mutation.isPending && <ReportView report={mutation.data} />}
        </div>

        {!mutation.isPending && !mutation.data && (
          <section className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              { title: "UI / UX", body: "Layout, visual hierarchy, spacing, and color balance." },
              { title: "Copywriting", body: "Headline clarity, CTA strength, and messaging focus." },
              { title: "Conversion", body: "Prioritized changes that lift signups and sales." },
            ].map((card) => (
              <div key={card.title} className="rounded-xl border border-border p-5">
                <h2 className="text-sm font-semibold tracking-tight">{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
