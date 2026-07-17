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
  return (await res.json()).access_token;
}

async function search(token: string, q: string) {
  const url = `${BASE_URL}/v1/clients/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await res.json();
  const data = j.data ?? j.results ?? j;
  const count = Array.isArray(data) ? data.length : 0;
  return { q, count, sample: Array.isArray(data) ? data.slice(0, 3) : data };
}

Deno.serve(async (req) => {
  const { queries } = await req.json();
  const token = await login();
  const results = [];
  for (const q of queries) {
    results.push(await search(token, q));
  }
  return new Response(JSON.stringify(results, null, 2), { headers: { "Content-Type": "application/json" } });
});
