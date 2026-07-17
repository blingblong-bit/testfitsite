const BASE_URL = "https://fitbeyondplus.antarisapi.com";
async function login() {
  const res = await fetch(`${BASE_URL}/v1/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: Deno.env.get("ANTARIS_EMAIL"), password: Deno.env.get("ANTARIS_PASSWORD") }),
  });
  return (await res.json()).access_token;
}
Deno.serve(async () => {
  const token = await login();
  const res = await fetch(`${BASE_URL}/v1/clients/4200/membershipStatus`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  return new Response(JSON.stringify({ status: res.status, body: text }, null, 2), { headers: { "Content-Type": "application/json" } });
});
