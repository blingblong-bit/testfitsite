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
          tags = CASE WHEN day_pass_purchased_at IS NOT NULL AND NOT ('day-pass'::text = ANY(tags)) THEN array_append(tags, 'day-pass'::text) ELSE tags END
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