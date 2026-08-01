CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  site_title text,
  overall_score integer NOT NULL DEFAULT 0,
  report jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reports TO anon;
GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shared reports are readable by anyone with the link"
  ON public.reports FOR SELECT
  TO anon, authenticated
  USING (true);