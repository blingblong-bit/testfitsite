/** Fail closed: only explicit configuration can resume outgoing texts. */
export function isOutboundSmsPaused(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== "false";
}

export const SMS_PAUSED_MESSAGE = "Texting is temporarily paused. No text was sent.";

export async function pausedSmsFetch(value: string | undefined, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isOutboundSmsPaused(value)) {
    return Response.json({ message: SMS_PAUSED_MESSAGE, code: "sms_paused" }, { status: 423 });
  }
  return fetch(input, init);
}