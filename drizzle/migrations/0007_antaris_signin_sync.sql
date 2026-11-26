CREATE TABLE public.gym_signins (
  antaris_signin_id bigint PRIMARY KEY,
  client_id text NOT NULL,
  scanned_at timestamptz NOT NULL,
  location_id integer NOT NULL,
  scan_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gym_signins TO authenticated;
GRANT ALL ON public.gym_signins TO service_role;
ALTER TABLE public.gym_signins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view gym signins" ON public.gym_signins FOR SELECT TO authenticated
USING ((select public.has_role((select auth.uid()), 'admin')) OR (select public.has_role((select auth.uid()), 'staff')));
CREATE INDEX gym_signins_client_scanned_idx ON public.gym_signins (client_id, scanned_at DESC);

CREATE TABLE public.gym_signin_sync_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  backfill_next_page integer,
  backfill_complete boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  last_result jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.gym_signin_sync_state TO service_role;
ALTER TABLE public.gym_signin_sync_state ENABLE ROW LEVEL SECURITY;
INSERT INTO public.gym_signin_sync_state (id) VALUES (1);

ALTER TABLE public.leads
  ADD COLUMN antaris_client_id text,
  ADD COLUMN antaris_link_checked_at timestamptz,
  ADD COLUMN last_visit_at timestamptz;
CREATE INDEX leads_antaris_client_id_idx ON public.leads (antaris_client_id) WHERE antaris_client_id IS NOT NULL;