// Diagnostic: trace checkMemberMatch for a single lead
const BASE_URL = "https://fitbeyondplus.antarisapi.com";

function digitsOnly(v: string | null | undefined) { return (v ?? "").replace(/\D/g, ""); }
function last10(v: string | null | undefined) { return digitsOnly(v).slice(-10); }
function eqCI(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function login() {
  const res = await fetch(`${BASE_URL}/v1/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: Deno.env.get("ANTARIS_EMAIL"),
      password: Deno.env.get("ANTARIS_PASSWORD"),
    }),
  });
  const j = await res.json();
  return { ok: res.ok, status: res.status, token: j.access_token ?? null };
}

async function search(token: string, q: string) {
  const url = `${BASE_URL}/v1/clients/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { url, q, status: res.status, raw: json ?? text };
}

async function membership(token: string, clientId: string) {
  const url = `${BASE_URL}/v1/clients/${encodeURIComponent(clientId)}/membershipStatus`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { url, status: res.status, raw: json ?? text };
}

function extractList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    const j = json as Record<string, unknown>;
    if (Array.isArray(j.data)) return j.data as Record<string, unknown>[];
    if (Array.isArray(j.results)) return j.results as Record<string, unknown>[];
  }
  return [];
}

function scoreBreakdown(
  c: Record<string, unknown>,
  name: string,
  email: string,
  phone: string,
) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  const rest = words.slice(1).join(" ");
  const cEmail = (c.email as string | null) ?? null;
  const cFirst = (c.first_name as string | null) ?? null;
  const cLast = (c.last_name as string | null) ?? null;
  const cCell = (c.cell_phone as string | null) ?? null;
  const cHome = (c.home_phone as string | null) ?? null;
  const target = last10(phone);

  const emailMatch = eqCI(cEmail, email);
  const firstMatch = !!first && eqCI(cFirst, first);
  const lastMatch = !!rest && eqCI(cLast, rest);
  const phoneMatch = target.length === 10 && (last10(cCell) === target || last10(cHome) === target);

  return {
    inputs: { name, email, phone, first_expected: first, last_expected: rest, phone_last10: target },
    candidate: { email: cEmail, first_name: cFirst, last_name: cLast, cell_phone: cCell, home_phone: cHome, cell_last10: last10(cCell), home_last10: last10(cHome) },
    criteria: {
      email_match: { passed: emailMatch, points: emailMatch ? 40 : 0 },
      first_name_match: { passed: firstMatch, points: firstMatch ? 20 : 0 },
      last_name_match: { passed: lastMatch, points: lastMatch ? 20 : 0 },
      phone_match: { passed: phoneMatch, points: phoneMatch ? 40 : 0 },
    },
    total: (emailMatch ? 40 : 0) + (firstMatch ? 20 : 0) + (lastMatch ? 20 : 0) + (phoneMatch ? 40 : 0),
  };
}

Deno.serve(async (req) => {
  const { name, email, phone } = await req.json();
  const trace: Record<string, unknown> = { input: { name, email, phone } };

  const l = await login();
  trace.login = { ok: l.ok, status: l.status, has_token: !!l.token };
  if (!l.token) return new Response(JSON.stringify(trace, null, 2), { headers: { "Content-Type": "application/json" } });

  const emailSearch = email ? await search(l.token, email) : null;
  trace.email_search = emailSearch;

  let results = emailSearch ? extractList(emailSearch.raw) : [];
  let usedQuery = email;

  if (results.length === 0 && name) {
    const nameSearch = await search(l.token, name);
    trace.name_search = nameSearch;
    results = extractList(nameSearch.raw);
    usedQuery = name;
  }

  trace.used_query = usedQuery;
  trace.results_count = results.length;
  trace.results_raw = results;

  if (results.length > 0) {
    const top = results[0];
    trace.top_candidate_raw = top;
    const score = scoreBreakdown(top, name, email, phone);
    trace.score_breakdown = score;
    const clientId = String(top.id ?? top.client_id ?? "");
    trace.client_id = clientId;
    if (clientId) {
      trace.membership_status = await membership(l.token, clientId);
    }
  }

  return new Response(JSON.stringify(trace, null, 2), { headers: { "Content-Type": "application/json" } });
});
