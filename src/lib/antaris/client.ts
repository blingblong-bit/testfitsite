// READ-ONLY Antaris API client.
// Only POST used is /v1/login. Never POST/PUT/PATCH/DELETE any other endpoint.
// Tokens expire after ~300s, so one is reused for 240s and then re-minted.
// Logging in on every lookup tripped the provider's rate limit (HTTP 429).

const BASE_URL = "https://fitbeyondplus.antarisapi.com";

const TOKEN_TTL_MS = 240_000;
let cachedToken: { token: string; expiresAt: number } | null = null;
let inFlight: Promise<string | null> | null = null;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requestToken(): Promise<string | null> {
  const env = getEnv();
  const email = env.get("ANTARIS_EMAIL");
  const password = env.get("ANTARIS_PASSWORD");
  if (!email || !password) {
    console.error("[antaris] missing ANTARIS_EMAIL/ANTARIS_PASSWORD");
    return null;
  }

  // Retry with backoff on rate limits / transient server errors.
  const delays = [500, 1500, 4000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const json = (await res.json()) as { access_token?: string };
        return json.access_token ?? null;
      }
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === delays.length) {
        console.error("[antaris] login failed", res.status);
        return null;
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : delays[attempt],
      );
    } catch (e) {
      if (attempt === delays.length) {
        console.error("[antaris] login exception", e);
        return null;
      }
      await sleep(delays[attempt]);
    }
  }
  return null;
}

async function login(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const token = await requestToken();
    cachedToken = token ? { token, expiresAt: Date.now() + TOKEN_TTL_MS } : null;
    return token;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
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

function hasPhoneMatch(c: AntarisClient, phone: string): boolean {
  const target = last10(phone);
  if (target.length !== 10) return false;
  return last10(c.cell_phone) === target || last10(c.home_phone) === target;
}

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

    // Antaris q= is single-term. Try email, then last name, then first name.
    // Many real members have placeholder emails (noemail####@antaris.ca), so
    // email search alone frequently returns zero — cascade to name terms.
    const words = name.trim().split(/\s+/).filter(Boolean);
    const first = words[0] ?? "";
    const last = words.slice(1).join(" ").trim();

    const queries: string[] = [];
    if (email) queries.push(email);
    if (last) queries.push(last);
    if (first) queries.push(first);

    let results: AntarisClient[] = [];
    for (const q of queries) {
      results = await searchClients(token, q);
      if (results.length > 0) break;
    }
    if (results.length === 0) return fallback;

    // Score every candidate and take the best. On ties, prefer phone match.
    let best: { c: AntarisClient; score: number; phone: boolean } | null = null;
    for (const c of results) {
      const score = scoreClient(c, name, email, phone);
      const phoneOk = hasPhoneMatch(c, phone);
      if (
        !best ||
        score > best.score ||
        (score === best.score && phoneOk && !best.phone)
      ) {
        best = { c, score, phone: phoneOk };
      }
    }
    if (!best) return fallback;

    const clientId = String(best.c.id ?? best.c.client_id ?? "");
    if (!clientId) return fallback;

    const { status } = await getMembershipStatus(token, clientId);

    return {
      isMember: status === "Active" && best.score >= 80,
      confidence: best.score,
      clientId,
      status,
    };
  } catch (e) {
    console.error("[antaris] checkMemberMatch exception", e);
    return fallback;
  }
}

export type ClassCheckinMatch = {
  isMember: boolean;
  clientId: string | null;
  status: string | null;
  reason:
    | "verified_phone_first"
    | "verified_name_no_phone_on_file"
    | "verified_first_only_unique_no_phone"
    | "ambiguous_first_only"
    | "phone_mismatch_on_file"
    | "inactive"
    | "no_candidate"
    | "insufficient_name";
};

// Class check-in verification rule (scoped ONLY to the kiosk check-in path).
// Does NOT use the 80-point threshold. See leads/sync flows for that.
export async function checkClassCheckinMatch(
  name: string,
  phone: string,
): Promise<ClassCheckinMatch> {
  const base: ClassCheckinMatch = {
    isMember: false,
    clientId: null,
    status: null,
    reason: "no_candidate",
  };
  try {
    const token = await login();
    if (!token) return base;

    const words = name.trim().split(/\s+/).filter(Boolean);
    const first = words[0] ?? "";
    const last = words.slice(1).join(" ").trim();

    const queries: string[] = [];
    if (last) queries.push(last);
    if (first) queries.push(first);
    if (queries.length === 0) return { ...base, reason: "insufficient_name" };

    let results: AntarisClient[] = [];
    for (const q of queries) {
      results = await searchClients(token, q);
      if (results.length > 0) break;
    }
    if (results.length === 0) return base;

    const target = last10(phone);

    // Prefer phone match, then first+last, then first-only.
    let phoneAndFirst: AntarisClient | null = null;
    let firstAndLastNoPhone: AntarisClient | null = null;
    let firstAndLastWithPhoneMismatch: AntarisClient | null = null;
    let anyFirst: AntarisClient | null = null;

    // Track first-only-no-phone candidates for the no-last-name fallback.
    const firstOnlyNoPhoneCandidates: AntarisClient[] = [];

    for (const c of results) {
      const firstOk = !!first && eqCI(c.first_name ?? "", first);
      const lastOk = !!last && eqCI(c.last_name ?? "", last);
      const cCell = last10(c.cell_phone);
      const cHome = last10(c.home_phone);
      const hasPhoneOnFile = cCell.length === 10 || cHome.length === 10;
      const phoneOk =
        target.length === 10 && (cCell === target || cHome === target);

      if (firstOk && phoneOk && !phoneAndFirst) phoneAndFirst = c;
      if (firstOk && lastOk && !hasPhoneOnFile && !firstAndLastNoPhone)
        firstAndLastNoPhone = c;
      if (firstOk && lastOk && hasPhoneOnFile && !phoneOk && !firstAndLastWithPhoneMismatch)
        firstAndLastWithPhoneMismatch = c;
      if (firstOk && !anyFirst) anyFirst = c;

      if (firstOk && !hasPhoneOnFile) firstOnlyNoPhoneCandidates.push(c);
    }

    // Fallback: user typed first name only (no last name) AND the matched
    // Antaris candidate has no phone on file AND is a unique first-name match.
    let firstOnlyUniqueNoPhone: AntarisClient | null = null;
    let ambiguousFirstOnly = false;
    if (!last && firstOnlyNoPhoneCandidates.length > 0) {
      if (firstOnlyNoPhoneCandidates.length === 1) {
        firstOnlyUniqueNoPhone = firstOnlyNoPhoneCandidates[0];
      } else {
        ambiguousFirstOnly = true;
      }
    }

    const picked =
      phoneAndFirst ??
      firstAndLastNoPhone ??
      firstOnlyUniqueNoPhone ??
      firstAndLastWithPhoneMismatch ??
      anyFirst;
    if (!picked) return base;

    const clientId = String(picked.id ?? picked.client_id ?? "");
    if (!clientId) return base;

    const { status } = await getMembershipStatus(token, clientId);
    const active = status === "Active";

    if (!active) {
      return { isMember: false, clientId, status, reason: "inactive" };
    }
    if (picked === phoneAndFirst) {
      return { isMember: true, clientId, status, reason: "verified_phone_first" };
    }
    if (picked === firstAndLastNoPhone) {
      return {
        isMember: true,
        clientId,
        status,
        reason: "verified_name_no_phone_on_file",
      };
    }
    if (picked === firstOnlyUniqueNoPhone) {
      return {
        isMember: true,
        clientId,
        status,
        reason: "verified_first_only_unique_no_phone",
      };
    }
    if (picked === firstAndLastWithPhoneMismatch) {
      return {
        isMember: false,
        clientId,
        status,
        reason: "phone_mismatch_on_file",
      };
    }
    if (ambiguousFirstOnly) {
      return { isMember: false, clientId, status, reason: "ambiguous_first_only" };
    }
    return { isMember: false, clientId, status, reason: "no_candidate" };
  } catch (e) {
    console.error("[antaris] checkClassCheckinMatch exception", e);
    return base;
  }
}
