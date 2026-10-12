CREATE OR REPLACE FUNCTION public.crm_interest_of(_interest text, _source text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT CASE
    WHEN t LIKE '%free week%' OR t LIKE '%free_week%' THEN 'Free Week'
    WHEN t LIKE '%personal training%' OR t LIKE '%personal_training%' THEN 'Personal Training'
    WHEN t ~ '(bjj|jiu|kickbox|combat)' THEN 'Combat Sports'
    WHEN t LIKE '%class%' THEN 'Classes'
    WHEN t LIKE '%day pass%' OR t LIKE '%day_pass%' THEN 'Day Pass'
    ELSE 'Membership' END
  FROM (SELECT lower(coalesce(_interest,'') || ' ' || coalesce(_source,'')) AS t) x
$$;

-- Contact fields on every new lead
CREATE OR REPLACE FUNCTION public.crm_leads_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.original_source := coalesce(NEW.original_source, NEW.source);
    NEW.latest_source := coalesce(NEW.latest_source, NEW.source);
    NEW.comm_pref := coalesce(NEW.comm_pref, CASE WHEN NEW.sms_opted_out THEN 'no_sms' ELSE 'sms' END);
  END IF;
  IF NEW.lead_type = 'spam' THEN NEW.contact_type := 'Spam';
  ELSIF NEW.lead_type = 'vendor_solicitation' THEN NEW.contact_type := 'Vendor/Non-Sales';
  ELSIF NEW.became_member OR NEW.lead_type = 'existing_member' THEN NEW.contact_type := 'Member';
  ELSIF NEW.contact_type IS NULL AND (TG_OP = 'INSERT' OR NOT NEW.review_flag) AND NEW.lead_type = 'customer_lead' THEN NEW.contact_type := 'Prospect';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_crm_leads_before_write BEFORE INSERT OR UPDATE OF lead_type, became_member ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.crm_leads_before_write();

-- New customer lead → one open New Lead opportunity
CREATE OR REPLACE FUNCTION public.crm_leads_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.lead_type = 'customer_lead' AND NOT NEW.became_member THEN
    INSERT INTO public.opportunities (contact_id, stage, interest, status, source, last_activity_at)
    VALUES (NEW.id, 'New Lead', public.crm_interest_of(NEW.interest, NEW.source), 'open', NEW.source, now())
    ON CONFLICT DO NOTHING;
    INSERT INTO public.contact_activity (contact_id, kind, summary, source, utm, idempotency_key)
    VALUES (NEW.id, 'form_submission', 'New lead from ' || NEW.source, NEW.source,
      jsonb_strip_nulls(jsonb_build_object('utm_source',NEW.utm_source,'utm_medium',NEW.utm_medium,'utm_campaign',NEW.utm_campaign,'landing_page',NEW.landing_page)),
      'lead-created:' || NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'crm_leads_after_insert failed: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_leads_after_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_crm_leads_after_insert AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.crm_leads_after_insert();

-- Became a member anywhere (old tracker, Antaris sync, CRM) → win only the open Membership opportunity
CREATE OR REPLACE FUNCTION public.crm_leads_after_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE n int;
BEGIN
  IF NEW.became_member AND NOT coalesce(OLD.became_member,false) THEN
    UPDATE public.opportunities SET stage = 'Joined — Won', status = 'won', last_activity_at = now()
      WHERE contact_id = NEW.id AND status = 'open' AND interest = 'Membership';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 AND NOT EXISTS (SELECT 1 FROM public.opportunities WHERE contact_id = NEW.id AND interest = 'Membership' AND status = 'won') THEN
      INSERT INTO public.opportunities (contact_id, stage, interest, status, source, last_activity_at)
      VALUES (NEW.id, 'Joined — Won', 'Membership', 'won', NEW.latest_source, now());
    END IF;
    INSERT INTO public.contact_activity (contact_id, kind, summary, idempotency_key)
    VALUES (NEW.id, 'stage_change', 'Became a member — Membership opportunity won', 'member-won:' || NEW.id || ':' || to_char(now(),'YYYYMMDD'))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'crm_leads_after_member failed: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_leads_after_member() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_crm_leads_after_member AFTER UPDATE OF became_member ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.crm_leads_after_member();