
CREATE TABLE public.monthly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid
);

CREATE INDEX monthly_snapshots_month_idx ON public.monthly_snapshots (month DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_snapshots TO authenticated;
GRANT ALL ON public.monthly_snapshots TO service_role;

ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view monthly snapshots"
  ON public.monthly_snapshots FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins can insert monthly snapshots"
  ON public.monthly_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update monthly snapshots"
  ON public.monthly_snapshots FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete monthly snapshots"
  ON public.monthly_snapshots FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
