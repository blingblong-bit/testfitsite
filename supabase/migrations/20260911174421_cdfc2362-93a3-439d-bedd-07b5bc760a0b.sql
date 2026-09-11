UPDATE public.leads
SET sequence_status = 'undeliverable',
    notes = COALESCE(notes || E'\n', '') || '[Sep 11, 2026] Text undelivered — carrier error 30003 (unreachable destination handset). Automated texting stopped; try calling.'
WHERE id = 'f69abf99-1667-4d38-b125-bb2ecd00823b';