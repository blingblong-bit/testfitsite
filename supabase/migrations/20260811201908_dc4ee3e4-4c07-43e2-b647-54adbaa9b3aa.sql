ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS landing_page text,
  ADD COLUMN IF NOT EXISTS initial_referrer text,
  ADD COLUMN IF NOT EXISTS attribution_channel text,
  ADD COLUMN IF NOT EXISTS first_touch_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS leads_utm_campaign_idx ON public.leads (utm_campaign);

DROP POLICY IF EXISTS "Anyone can submit a valid lead" ON public.leads;

CREATE POLICY "Anyone can submit a valid lead"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 120)
  AND (length(TRIM(BOTH FROM email)) >= 3 AND length(TRIM(BOTH FROM email)) <= 254)
  AND (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)
  AND (phone IS NULL OR length(phone) <= 40)
  AND (interest IS NULL OR length(interest) <= 120)
  AND (message IS NULL OR length(message) <= 4000)
  AND (length(source) >= 1 AND length(source) <= 60)
  AND (utm_source IS NULL OR length(utm_source) <= 120)
  AND (utm_medium IS NULL OR length(utm_medium) <= 120)
  AND (utm_campaign IS NULL OR length(utm_campaign) <= 200)
  AND (utm_content IS NULL OR length(utm_content) <= 200)
  AND (utm_term IS NULL OR length(utm_term) <= 200)
  AND (landing_page IS NULL OR length(landing_page) <= 300)
  AND (initial_referrer IS NULL OR length(initial_referrer) <= 300)
  AND (attribution_channel IS NULL OR length(attribution_channel) <= 60)
);