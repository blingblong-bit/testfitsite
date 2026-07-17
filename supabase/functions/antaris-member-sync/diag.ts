import { checkMemberMatch } from "./antaris-client.ts";
Deno.serve(async (req) => {
  const { name, email, phone } = await req.json();
  const r = await checkMemberMatch(name, email, phone);
  return new Response(JSON.stringify(r, null, 2), { headers: { "Content-Type": "application/json" } });
});
