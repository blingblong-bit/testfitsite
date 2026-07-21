
CREATE TABLE public.class_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  antaris_client_id TEXT,
  class_name TEXT NOT NULL,
  class_day TEXT NOT NULL,
  class_time TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified BOOLEAN NOT NULL DEFAULT false,
  added_manually BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_checkins TO authenticated;
GRANT INSERT ON public.class_checkins TO anon;
GRANT ALL ON public.class_checkins TO service_role;
ALTER TABLE public.class_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert check-ins" ON public.class_checkins
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can view check-ins" ON public.class_checkins
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update check-ins" ON public.class_checkins
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete check-ins" ON public.class_checkins
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX class_checkins_checked_in_at_idx ON public.class_checkins (checked_in_at DESC);

CREATE TABLE public.class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name TEXT NOT NULL,
  session_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'held',
  canceled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.class_sessions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated;
GRANT ALL ON public.class_sessions TO service_role;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view class sessions" ON public.class_sessions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert class sessions" ON public.class_sessions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update class sessions" ON public.class_sessions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete class sessions" ON public.class_sessions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX class_sessions_date_idx ON public.class_sessions (session_date DESC);
