ALTER TABLE public.leads DROP CONSTRAINT leads_lead_type_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_lead_type_check
  CHECK (lead_type = ANY (ARRAY['customer_lead','existing_member','vendor_solicitation','spam']));

UPDATE public.leads
SET lead_type = 'existing_member', should_notify = false
WHERE became_member = true
  AND crm_status = 'Joined'
  AND lead_type = 'customer_lead'
  AND notes ILIKE '%Antaris match%';