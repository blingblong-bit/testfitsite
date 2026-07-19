const BASE_URL = "https://fitbeyondplus.antarisapi.com";

async function login() {
  const res = await fetch(`${BASE_URL}/v1/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: Deno.env.get("ANTARIS_EMAIL"),
      password: Deno.env.get("ANTARIS_PASSWORD"),
    }),
  });
  return (await res.json()).access_token as string;
}

function last10(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "").slice(-10);
}
function eqCI(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

Deno.serve(async (req) => {
  const { name, email, phone } = await req.json();
  const token = await login();
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  const last = words.slice(1).join(" ").trim();
  const queries = [email, last, first].filter(Boolean);
  const attempts: any[] = [];
  let winning: any[] = [];
  let usedQ = "";
  for (const q of queries) {
    const r = await fetch(`${BASE_URL}/v1/clients/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    const arr = Array.isArray(j) ? j : j.data ?? j.results ?? [];
    attempts.push({ q, count: arr.length, sample: arr.slice(0, 5) });
    if (arr.length > 0 && winning.length === 0) {
      winning = arr;
      usedQ = q;
    }
  }
  const scored = winning.map((c: any) => {
    const email_match = eqCI(c.email, email);
    const first_match = first && eqCI(c.first_name, first);
    const last_match = last && eqCI(c.last_name, last);
    const target = last10(phone);
    const phone_match = target.length === 10 &&
      (last10(c.cell_phone) === target || last10(c.home_phone) === target);
    const score = (email_match ? 40 : 0) + (first_match ? 20 : 0) +
      (last_match ? 20 : 0) + (phone_match ? 40 : 0);
    return { id: c.id ?? c.client_id, first_name: c.first_name, last_name: c.last_name, email: c.email, cell_phone: c.cell_phone, home_phone: c.home_phone, email_match, first_match, last_match, phone_match, score };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  let membership: any = null;
  let rawMembership: any = null;
  if (best) {
    const mr = await fetch(`${BASE_URL}/v1/clients/${best.id}/membershipStatus`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    rawMembership = await mr.json();
    membership = rawMembership;
  }
  let clientDetail: any = null;
  if (best) {
    const cr = await fetch(`${BASE_URL}/v1/clients/${best.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (cr.ok) clientDetail = await cr.json();
  }

  return new Response(JSON.stringify({ input: { name, email, phone }, usedQ, attempts, scored, membership, rawMembership, clientDetail }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
