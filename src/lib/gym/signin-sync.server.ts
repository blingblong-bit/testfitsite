// Polls the Antaris location sign-in feed (read-only) into public.gym_signins.
// Never logs member data — only counts.
import { fetchLocationSigninsPage, checkMemberMatch, type AntarisSignin } from "@/lib/antaris/client";

const LOCATION_ID = 2;
const MAX_NEW_PAGES = 20;
const MAX_BACKFILL_PAGES = 25;
const BACKFILL_DAYS = 45;
const LINKS_PER_RUN = 5;
const RELINK_AFTER_DAYS = 7;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

function toRow(s: AntarisSignin) {
  return {
    antaris_signin_id: Number(s.id),
    client_id: String(s.client_id),
    scanned_at: new Date(Number(s.date) * 1000).toISOString(),
    location_id: Number(s.location_id ?? LOCATION_ID),
    scan_type: s.type ?? null,
  };
}

async function insertRows(admin: Admin, rows: AntarisSignin[], touched: Set<string>) {
  if (!rows.length) return 0;
  const mapped = rows.filter((r) => r && r.id && r.client_id && r.date).map(toRow);
  const { data, error } = await admin
    .from("gym_signins")
    .upsert(mapped, { onConflict: "antaris_signin_id", ignoreDuplicates: true })
    .select("client_id");
  if (error) throw new Error("insert_failed");
  for (const r of data ?? []) touched.add(r.client_id);
  return (data ?? []).length;
}

export async function runSigninSync(admin: Admin) {
  const touched = new Set<string>();
  const result: Record<string, unknown> = { inserted: 0, newPages: 0, backfillPages: 0, linked: 0 };

  const { data: maxRow } = await admin
    .from("gym_signins").select("antaris_signin_id")
    .order("antaris_signin_id", { ascending: false }).limit(1).maybeSingle();
  const maxId: number | null = maxRow?.antaris_signin_id ?? null;

  // Pass 1: newest scans until we reach an already-stored id.
  if (maxId !== null) {
    for (let page = 1; page <= MAX_NEW_PAGES; page++) {
      const p = await fetchLocationSigninsPage(LOCATION_ID, page);
      if (!p.ok) { result.error = `antaris_${p.status}`; break; }
      result.newPages = page;
      const fresh = p.rows.filter((r) => Number(r.id) > maxId);
      result.inserted = (result.inserted as number) + (await insertRows(admin, fresh, touched));
      if (fresh.length < p.rows.length || page >= p.totalPages || !p.rows.length) break;
    }
  }

  // Pass 2: one-time history backfill (last 45 days), resumable across runs.
  const { data: state } = await admin.from("gym_signin_sync_state").select("*").eq("id", 1).maybeSingle();
  if (state && !state.backfill_complete) {
    const cutoff = Date.now() - BACKFILL_DAYS * 86_400_000;
    let page: number = state.backfill_next_page ?? 1;
    let complete = false;
    for (let i = 0; i < MAX_BACKFILL_PAGES; i++, page++) {
      const p = await fetchLocationSigninsPage(LOCATION_ID, page);
      if (!p.ok) { result.error = `antaris_${p.status}`; break; }
      result.backfillPages = (result.backfillPages as number) + 1;
      result.inserted = (result.inserted as number) + (await insertRows(admin, p.rows, touched));
      const oldest = Math.min(...p.rows.map((r) => Number(r.date) * 1000));
      if (!p.rows.length || page >= p.totalPages || oldest < cutoff) { complete = true; page++; break; }
    }
    await admin.from("gym_signin_sync_state").update({
      backfill_next_page: page, backfill_complete: complete, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    result.backfillComplete = complete;
  }

  // Link a few unlinked member contacts to their Antaris client id.
  const relinkBefore = new Date(Date.now() - RELINK_AFTER_DAYS * 86_400_000).toISOString();
  const { data: unlinked } = await admin
    .from("leads").select("id, name, email, phone, antaris_link_checked_at")
    .is("antaris_client_id", null)
    .or("contact_type.eq.Member,became_member.eq.true")
    .order("antaris_link_checked_at", { ascending: true, nullsFirst: true })
    .limit(LINKS_PER_RUN);
  const due = (unlinked ?? []).filter(
    (l: { antaris_link_checked_at: string | null }) => !l.antaris_link_checked_at || l.antaris_link_checked_at < relinkBefore,
  );
  for (const l of due) {
    const m = await checkMemberMatch(l.name ?? "", l.email ?? "", l.phone ?? "");
    const ok = m.clientId && m.confidence >= 80;
    await admin.from("leads").update({
      antaris_link_checked_at: new Date().toISOString(),
      ...(ok ? { antaris_client_id: m.clientId } : {}),
    }).eq("id", l.id);
    if (ok) { touched.add(String(m.clientId)); result.linked = (result.linked as number) + 1; }
  }

  // Refresh last_visit_at for linked contacts whose scans changed.
  if (touched.size) {
    const ids = [...touched];
    const { data: linked } = await admin.from("leads").select("id, antaris_client_id").in("antaris_client_id", ids);
    for (const l of linked ?? []) {
      const { data: last } = await admin.from("gym_signins").select("scanned_at")
        .eq("client_id", l.antaris_client_id).order("scanned_at", { ascending: false }).limit(1).maybeSingle();
      if (last) await admin.from("leads").update({ last_visit_at: last.scanned_at }).eq("id", l.id);
    }
  }

  await admin.from("gym_signin_sync_state").update({
    last_run_at: new Date().toISOString(), last_result: result,
  }).eq("id", 1);
  return result;
}
