-- Contact fields on leads (additive)
ALTER TABLE public.leads ADD COLUMN contact_type text;
ALTER TABLE public.leads ADD COLUMN original_source text;
ALTER TABLE public.leads ADD COLUMN latest_source text;
ALTER TABLE public.leads ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.leads ADD COLUMN owner_id uuid;
ALTER TABLE public.leads ADD COLUMN comm_pref text;
ALTER TABLE public.leads ADD COLUMN review_flag boolean NOT NULL DEFAULT false;
ALTER TABLE public.leads ADD COLUMN review_reason text;
ALTER TABLE public.leads ADD CONSTRAINT leads_contact_type_check CHECK (contact_type IS NULL OR contact_type IN ('Prospect','Member','Former Member','Vendor/Non-Sales','Spam'));

-- Opportunities
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.leads(id),
  pipeline text NOT NULL DEFAULT 'FIT Sales',
  stage text NOT NULL,
  interest text NOT NULL DEFAULT 'Other',
  status text NOT NULL DEFAULT 'open',
  value numeric,
  owner_id uuid,
  source text,
  no_action_required boolean NOT NULL DEFAULT false,
  last_activity_at timestamptz,
  appointment_id uuid REFERENCES public.appointments(id),
  won_lost_reason text,
  closed_at timestamptz,
  migration_version text,
  legacy_lead_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_stage_check CHECK (stage IN ('New Lead','Attempting Contact','Engaged','Tour or Assessment Booked','Trial or Day Pass Active','Decision and Follow-Up','Long-Term Nurture','Joined — Won','Closed — Lost')),
  CONSTRAINT opportunities_status_check CHECK (status IN ('open','won','lost')),
  CONSTRAINT opportunities_interest_check CHECK (interest IN ('Membership','Personal Training','Combat Sports','Classes','Day Pass','Free Week','Other'))
);
CREATE UNIQUE INDEX opportunities_one_open_per_interest ON public.opportunities (contact_id, interest) WHERE status = 'open';
CREATE UNIQUE INDEX opportunities_migration_legacy ON public.opportunities (migration_version, legacy_lead_id) WHERE migration_version IS NOT NULL;
CREATE INDEX opportunities_contact_idx ON public.opportunities (contact_id);
GRANT SELECT, INSERT, UPDATE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage opportunities" ON public.opportunities FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Stage/status sync, enforced in the same transaction as every write
CREATE OR REPLACE FUNCTION public.opportunities_enforce_stage_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE expected text;
BEGIN
  expected := CASE NEW.stage WHEN 'Joined — Won' THEN 'won' WHEN 'Closed — Lost' THEN 'lost' ELSE 'open' END;
  IF NEW.status IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Stage "%" requires status "%" (got "%")', NEW.stage, expected, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF expected = 'open' THEN NEW.closed_at := NULL;
  ELSIF NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_opportunities_stage_status BEFORE INSERT OR UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.opportunities_enforce_stage_status();

-- Tasks
CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.leads(id),
  opportunity_id uuid REFERENCES public.opportunities(id),
  type text NOT NULL DEFAULT 'custom',
  title text NOT NULL,
  due_at timestamptz,
  owner_id uuid,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_tasks_contact_idx ON public.crm_tasks (contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage tasks" ON public.crm_tasks FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Activity
CREATE TABLE public.contact_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.leads(id),
  opportunity_id uuid REFERENCES public.opportunities(id),
  kind text NOT NULL,
  summary text,
  source text,
  utm jsonb,
  metadata jsonb,
  idempotency_key text UNIQUE,
  actor_id uuid,
  migration_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_activity_contact_idx ON public.contact_activity (contact_id, created_at DESC);
GRANT SELECT, INSERT ON public.contact_activity TO authenticated;
GRANT ALL ON public.contact_activity TO service_role;
ALTER TABLE public.contact_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read activity" ON public.contact_activity FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff add activity" ON public.contact_activity FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Backup + ledger (admin read only; writes service role only)
CREATE TABLE public.crm_migration_snapshot (
  migration_version text NOT NULL,
  lead_id uuid NOT NULL,
  row_data jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (migration_version, lead_id)
);
GRANT SELECT ON public.crm_migration_snapshot TO authenticated;
GRANT ALL ON public.crm_migration_snapshot TO service_role;
ALTER TABLE public.crm_migration_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read snapshot" ON public.crm_migration_snapshot FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.crm_migration_ledger (
  migration_version text NOT NULL,
  lead_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  planned_stage text,
  opportunity_id uuid,
  review_reason text,
  error text,
  attempts int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (migration_version, lead_id),
  CONSTRAINT crm_ledger_status_check CHECK (status IN ('pending','done','failed','skipped_review'))
);
GRANT SELECT ON public.crm_migration_ledger TO authenticated;
GRANT ALL ON public.crm_migration_ledger TO service_role;
ALTER TABLE public.crm_migration_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read ledger" ON public.crm_migration_ledger FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Classification (pure read)
CREATE OR REPLACE FUNCTION public.crm_v1_classify(_lead_id uuid)
RETURNS TABLE(outcome text, stage text, contact_type text, interest text, review_reason text, last_activity timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  l public.leads%ROWTYPE;
  has_in boolean; last_act timestamptz; future_tour boolean; active_trial boolean; dup int; digits text; txt text;
BEGIN
  SELECT * INTO l FROM public.leads WHERE id = _lead_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.sms_conversation_log s WHERE s.lead_id = l.id AND s.direction = 'inbound') INTO has_in;
  SELECT greatest(l.created_at, coalesce(l.last_contacted_at,l.created_at), coalesce(l.last_response_at,l.created_at),
    coalesce((SELECT max(s.created_at) FROM public.sms_conversation_log s WHERE s.lead_id = l.id), l.created_at),
    coalesce((SELECT max(a.created_at) FROM public.appointments a WHERE a.lead_id = l.id), l.created_at)) INTO last_act;
  SELECT EXISTS(SELECT 1 FROM public.appointments a WHERE a.lead_id = l.id AND a.status = 'confirmed' AND coalesce(a.confirmed_time,a.requested_time) > now()) INTO future_tour;
  SELECT EXISTS(SELECT 1 FROM public.referrals r WHERE r.lead_id = l.id AND r.promo_type = 'free_week' AND r.access_ends_at > now()) INTO active_trial;
  digits := right(regexp_replace(coalesce(l.phone,''),'\D','','g'),10);
  SELECT count(*) INTO dup FROM public.leads l2 WHERE l2.id <> l.id AND length(digits) = 10
    AND right(regexp_replace(coalesce(l2.phone,''),'\D','','g'),10) = digits;
  txt := lower(coalesce(l.interest,'') || ' ' || coalesce(l.source,''));
  interest := CASE
    WHEN txt LIKE '%free week%' OR txt LIKE '%free_week%' THEN 'Free Week'
    WHEN txt LIKE '%personal training%' OR txt LIKE '%personal_training%' THEN 'Personal Training'
    WHEN txt ~ '(bjj|jiu|kickbox|combat)' THEN 'Combat Sports'
    WHEN txt LIKE '%class%' THEN 'Classes'
    WHEN txt LIKE '%day pass%' OR txt LIKE '%day_pass%' THEN 'Day Pass'
    ELSE 'Membership' END;
  last_activity := last_act;
  IF l.lead_type = 'spam' THEN outcome := 'contact_only'; contact_type := 'Spam';
  ELSIF l.lead_type = 'vendor_solicitation' THEN outcome := 'contact_only'; contact_type := 'Vendor/Non-Sales';
  ELSIF dup > 0 THEN outcome := 'review'; review_reason := 'Phone number shared with another record — merge decision needed';
  ELSIF l.lead_type = 'existing_member' AND l.crm_status IS DISTINCT FROM 'Joined' THEN outcome := 'review'; review_reason := 'Existing member but CRM status is "' || coalesce(l.crm_status,'') || '"';
  ELSIF (l.became_member AND l.crm_status IS DISTINCT FROM 'Joined') OR (l.crm_status = 'Joined' AND NOT l.became_member) THEN outcome := 'review'; review_reason := 'Member flag conflicts with CRM status "' || coalesce(l.crm_status,'') || '"';
  ELSIF l.sequence_status = 'undeliverable' THEN outcome := 'review'; review_reason := 'Phone is undeliverable — needs a working number';
  ELSIF l.lead_type = 'existing_member' THEN outcome := 'contact_only'; contact_type := 'Member';
  ELSIF l.became_member OR l.crm_status = 'Joined' THEN outcome := 'opportunity'; contact_type := 'Member'; stage := 'Joined — Won'; interest := 'Membership';
  ELSIF l.crm_status = 'Lost Lead' THEN outcome := 'opportunity'; contact_type := 'Prospect'; stage := 'Closed — Lost';
  ELSIF future_tour OR l.crm_status = 'Tour Scheduled' THEN outcome := 'opportunity'; contact_type := 'Prospect'; stage := 'Tour or Assessment Booked';
  ELSIF active_trial THEN outcome := 'opportunity'; contact_type := 'Prospect'; stage := 'Trial or Day Pass Active'; interest := 'Free Week';
  ELSIF l.crm_status = 'Tour Completed' AND last_act > now() - interval '14 days' THEN outcome := 'opportunity'; contact_type := 'Prospect'; stage := 'Decision and Follow-Up';
  ELSIF last_act <= now() - interval '14 days' THEN outcome := 'opportunity'; contact_type := 'Prospect'; stage := 'Long-Term Nurture';
  ELSIF has_in THEN outcome := 'opportunity'; contact_type := 'Prospect'; stage := 'Engaged';
  ELSE outcome := 'opportunity'; contact_type := 'Prospect'; stage := 'Attempting Contact';
  END IF;
  RETURN NEXT;
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_v1_classify(uuid) FROM PUBLIC, anon, authenticated;

-- Resumable migration runner
CREATE OR REPLACE FUNCTION public.crm_migrate_v1(dry_run boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v text := 'crm-v1'; r record; c record; opp_id uuid; counts jsonb := '{}'::jsonb; k text;
BEGIN
  IF dry_run THEN
    FOR r IN SELECT id FROM public.leads LOOP
      SELECT * INTO c FROM public.crm_v1_classify(r.id);
      k := CASE c.outcome WHEN 'review' THEN 'Review flag' WHEN 'contact_only' THEN 'No opportunity — ' || c.contact_type ELSE c.stage END;
      counts := jsonb_set(counts, ARRAY[k], to_jsonb(coalesce((counts->>k)::int,0)+1));
    END LOOP;
    RETURN counts;
  END IF;

  INSERT INTO public.crm_migration_snapshot (migration_version, lead_id, row_data)
    SELECT v, l.id, to_jsonb(l) FROM public.leads l ON CONFLICT DO NOTHING;
  INSERT INTO public.crm_migration_ledger (migration_version, lead_id)
    SELECT v, l.id FROM public.leads l ON CONFLICT DO NOTHING;

  FOR r IN SELECT lead_id FROM public.crm_migration_ledger WHERE migration_version = v AND status IN ('pending','failed') LOOP
    BEGIN
      SELECT * INTO c FROM public.crm_v1_classify(r.lead_id);
      IF c.outcome = 'review' THEN
        UPDATE public.leads SET review_flag = true, review_reason = c.review_reason WHERE id = r.lead_id;
        UPDATE public.crm_migration_ledger SET status='skipped_review', review_reason=c.review_reason, error=NULL, attempts=attempts+1, updated_at=now()
          WHERE migration_version=v AND lead_id=r.lead_id;
      ELSE
        UPDATE public.leads SET contact_type = c.contact_type,
          original_source = coalesce(original_source, source),
          latest_source = coalesce(latest_source, source),
          comm_pref = coalesce(comm_pref, CASE WHEN sms_opted_out OR sequence_status='opted_out' THEN 'no_sms' ELSE 'sms' END),
          tags = CASE WHEN day_pass_purchased_at IS NOT NULL AND NOT ('day-pass' = ANY(tags)) THEN tags || 'day-pass' ELSE tags END
        WHERE id = r.lead_id;
        opp_id := NULL;
        IF c.outcome = 'opportunity' THEN
          INSERT INTO public.opportunities (contact_id, stage, interest, status, source, no_action_required, last_activity_at, won_lost_reason, migration_version, legacy_lead_id)
          SELECT l.id, c.stage, c.interest,
            CASE c.stage WHEN 'Joined — Won' THEN 'won' WHEN 'Closed — Lost' THEN 'lost' ELSE 'open' END,
            l.source, true, c.last_activity,
            CASE WHEN c.stage='Closed — Lost' THEN array_to_string(l.lost_reasons, ', ') END,
            v, l.id
          FROM public.leads l WHERE l.id = r.lead_id
          ON CONFLICT (migration_version, legacy_lead_id) WHERE migration_version IS NOT NULL DO NOTHING
          RETURNING id INTO opp_id;
          IF opp_id IS NULL THEN SELECT id INTO opp_id FROM public.opportunities WHERE migration_version=v AND legacy_lead_id=r.lead_id; END IF;
          INSERT INTO public.contact_activity (contact_id, opportunity_id, kind, summary, idempotency_key, migration_version)
          VALUES (r.lead_id, opp_id, 'migration', 'Migrated to FIT Sales: ' || c.stage, v || ':' || r.lead_id, v)
          ON CONFLICT (idempotency_key) DO NOTHING;
        END IF;
        UPDATE public.crm_migration_ledger SET status='done', planned_stage=coalesce(c.stage,'(contact only)'), opportunity_id=opp_id, error=NULL, attempts=attempts+1, updated_at=now()
          WHERE migration_version=v AND lead_id=r.lead_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.crm_migration_ledger SET status='failed', error=SQLERRM, attempts=attempts+1, updated_at=now()
        WHERE migration_version=v AND lead_id=r.lead_id;
    END;
  END LOOP;
  SELECT jsonb_object_agg(status, n) INTO counts FROM (SELECT status, count(*) n FROM public.crm_migration_ledger WHERE migration_version=v GROUP BY status) s;
  RETURN counts;
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_migrate_v1(boolean) FROM PUBLIC, anon, authenticated;