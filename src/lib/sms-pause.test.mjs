import { afterEach, expect, test } from "bun:test";
import { isOutboundSmsPaused, pausedSmsFetch } from "./sms-pause.ts";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
test("outgoing texts remain paused without an explicit resume", async () => {
  let requests = 0;
  globalThis.fetch = (async () => { requests++; return new Response(); });
  for (const value of [undefined, "true", "", "invalid"]) {
    expect(isOutboundSmsPaused(value)).toBe(true);
    expect((await pausedSmsFetch(value, "https://example.com", { method: "POST" })).status).toBe(423);
  }
  expect(requests).toBe(0);
});
test("texts resume only with explicit false configuration", async () => {
  let requests = 0;
  globalThis.fetch = (async () => { requests++; return new Response("accepted"); });
  expect(isOutboundSmsPaused("false")).toBe(false);
  expect(await (await pausedSmsFetch("false", "https://example.com")).text()).toBe("accepted");
  expect(requests).toBe(1);
});