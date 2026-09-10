CREATE TABLE public.day_pass_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_method text,
  amount numeric,
  recorded_via text NOT NULL DEFAULT 'checkin',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX day_pass_purchases_lead_id_idx ON public.day_pass_purchases(lead_id);
CREATE UNIQUE INDEX day_pass_purchases_lead_time_idx ON public.day_pass_purchases(lead_id, purchased_at);

GRANT SELECT ON public.day_pass_purchases TO authenticated;
GRANT ALL ON public.day_pass_purchases TO service_role;

ALTER TABLE public.day_pass_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view day pass purchases"
ON public.day_pass_purchases
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Backfill 1: dated "Day pass walk-in" / "day pass" note lines like "[2026-08-22T14:03:00Z] Day pass walk-in — paid via venmo"
INSERT INTO public.day_pass_purchases (lead_id, purchased_at, payment_method, amount, recorded_via)
SELECT l.id,
       (m[1])::timestamptz,
       l.payment_method,
       l.day_pass_price,
       'backfill_notes'
FROM public.leads l
CROSS JOIN LATERAL regexp_matches(coalesce(l.notes, ''), '\[([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.+Z-]+)\][^\n]*[Dd]ay pass', 'g') AS m
ON CONFLICT DO NOTHING;

-- Backfill 2: the latest purchase timestamp for any lead with purchase evidence
INSERT INTO public.day_pass_purchases (lead_id, purchased_at, payment_method, amount, recorded_via)
SELECT l.id, l.day_pass_purchased_at, l.payment_method, l.day_pass_price, 'backfill_lead'
FROM public.leads l
WHERE l.day_pass_purchased_at IS NOT NULL
ON CONFLICT DO NOTHING;