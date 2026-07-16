// READ-ONLY Antaris API client.
// Only POST used is /v1/login. Never POST/PUT/PATCH/DELETE any other endpoint.
// Token expires every 300s — always login fresh, never cache.

const BASE_URL = "https://fitbeyondplus.antarisapi.com";

type AntarisEnv = {
  get(key: string): string | undefined;
};

function getEnv(): AntarisEnv {
  // Support both Deno (edge functions) and Node (server functions).
  const denoEnv = (globalThis as unknown as { Deno?: { env: AntarisEnv } }).Deno
    ?.env;
  if (denoEnv) return denoEnv;
  return {
    get: (k: string) =>
      (globalThis as unknown as { process?: { env: Record<string, string | undefined> } })
        .process?.env?.[k],
  };
}

async function login(): Promise<string | null> {
  try {
    const env = getEnv();
    const email = env.get("ANTARIS_EMAIL");
    const password = env.get("ANTARIS_PASSWORD");
    if (!email || !password) {
      console.error("[antaris] missing ANTARIS_EMAIL/ANTARIS_PASSWORD");
      return null;
    }
    const res = await fetch(`${BASE_URL}/v1/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      console.error("[antaris] login failed", res.status);
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (e) {
    console.error("[antaris] login exception", e);
    return null;
  }
}

async function searchClients(
  token: string,
  q: string,
): Promise<AntarisClient[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/clients/search?q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const json = await res.json();
    if (Array.isArray(json)) return json as AntarisClient[];
    if (json && Array.isArray(json.data)) return json.data as AntarisClient[];
    if (json && Array.isArray(json.results))
      return json.results as AntarisClient[];
    return [];
  } catch (e) {
    console.error("[antaris] search exception", e);
    return [];
  }
}

type AntarisClient = {
  id?: string | number;
  client_id?: string | number;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  cell_phone?: string | null;
  home_phone?: string | null;
};

function digitsOnly(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function last10(v: string | null | undefined): string {
  const d = digitsOnly(v);
  return d.slice(-10);
}

function eqCI(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

function scoreClient(
  c: AntarisClient,
  name: string,
  email: string,
  phone: string,
): number {
  let score = 0;
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  const rest = words.slice(1).join(" ");

  if (eqCI(c.email ?? "", email)) score += 40;
  if (first && eqCI(c.first_name ?? "", first)) score += 20;
  if (rest && eqCI(c.last_name ?? "", rest)) score += 20;

  const target = last10(phone);
  if (target && target.length === 10) {
    if (last10(c.cell_phone) === target || last10(c.home_phone) === target) {
      score += 40;
    }
  }
  return score;
}

async function getMembershipStatus(
  token: string,
  clientId: string | number,
): Promise<{ status: string | null }> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/clients/${encodeURIComponent(String(clientId))}/membershipStatus`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { status: null };
    const json = await res.json();
    const status =
      (json && (json.status as string)) ??
      (json && json.data && (json.data.status as string)) ??
      null;
    return { status: status ?? null };
  } catch (e) {
    console.error("[antaris] membershipStatus exception", e);
    return { status: null };
  }
}

export type MemberMatch = {
  isMember: boolean;
  confidence: number;
  clientId: string | null;
  status: string | null;
};

export async function checkMemberMatch(
  name: string,
  email: string,
  phone: string,
): Promise<MemberMatch> {
  const fallback: MemberMatch = {
    isMember: false,
    confidence: 0,
    clientId: null,
    status: null,
  };
  try {
    const token = await login();
    if (!token) return fallback;

    let results: AntarisClient[] = [];
    if (email) results = await searchClients(token, email);
    if (results.length === 0 && name)
      results = await searchClients(token, name);
    if (results.length === 0) return fallback;

    const top = results[0];
    const clientId = String(top.id ?? top.client_id ?? "");
    if (!clientId) return fallback;

    const score = scoreClient(top, name, email, phone);
    const { status } = await getMembershipStatus(token, clientId);

    return {
      isMember: status === "Active" && score >= 80,
      confidence: score,
      clientId,
      status,
    };
  } catch (e) {
    console.error("[antaris] checkMemberMatch exception", e);
    return fallback;
  }
}
