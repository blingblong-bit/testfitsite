ALTER TABLE public.leads DROP CONSTRAINT leads_crm_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_crm_status_check
  CHECK (crm_status IS NULL OR crm_status = ANY (ARRAY['New Lead','Contacted','Waiting on Response','Tour Scheduled','Tour Completed','Joined','Lost Lead','Nurture']));