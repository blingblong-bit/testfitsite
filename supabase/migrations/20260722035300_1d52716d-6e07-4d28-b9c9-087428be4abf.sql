-- Public class check-ins are inserted via a server function that uses the
-- service-role admin client (bypasses RLS), so the anon INSERT policy with
-- WITH CHECK (true) is unnecessary and overly permissive.
DROP POLICY IF EXISTS "Anyone can insert check-ins" ON public.class_checkins;
REVOKE INSERT ON public.class_checkins FROM anon;

-- Keep an explicit admin INSERT policy so staff manual-add works via the
-- authenticated client on the admin page.
DROP POLICY IF EXISTS "Admins can insert check-ins" ON public.class_checkins;
CREATE POLICY "Admins can insert check-ins"
ON public.class_checkins
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));