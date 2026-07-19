UPDATE public.leads
SET lead_type = 'customer_lead',
    notes = COALESCE(notes, '') || E'\n[' || now()::text || '] Reclassified — Antaris join date (2026-07-19) is after lead creation (2026-07-01); genuine conversion, restored to customer_lead.'
WHERE id = 'e18e7245-4611-4297-a6a7-f3fa18fafd6d';