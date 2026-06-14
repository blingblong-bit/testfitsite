
-- Lock down has_role function execution
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;

-- Replace the permissive insert policy with a validated one
DROP POLICY "Anyone can submit a lead" ON public.leads;

CREATE POLICY "Anyone can submit a valid lead"
  ON public.leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 120
    AND length(trim(email)) BETWEEN 3 AND 254
    AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND (phone IS NULL OR length(phone) <= 40)
    AND (interest IS NULL OR length(interest) <= 120)
    AND (message IS NULL OR length(message) <= 4000)
    AND length(source) BETWEEN 1 AND 60
  );
