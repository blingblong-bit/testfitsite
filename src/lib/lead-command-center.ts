import { chicagoDateOf } from "./chicago-time";

export type CommandMessage = {
  id: string;
  lead_id: string | null;
  direction: string;
  body: string;
  status: string | null;
  delivery_status: string | null;
  error_code: string | null;
  from_ai: boolean;
  created_at: string;
  metadata: { sent_by?: string; kind?: string; test_mode?: boolean } | null;
};

export type CommandAppointment = {
  id: string;
  lead_id: string | null;
  requested_time: string;
  confirmed_time: string | null;
  suggested_time: string | null;
  status: string;
  type: string;
  created_at: string;
};

export type CommandLead = {
  id: string;
  created_at: string;
  lead_type?: string | null;
  crm_status?: string | null;
  sequence_status?: string | null;
  followup_count?: number | null;
  last_sms_at?: string | null;
  next_action?: string | null;
  high_intent?: boolean | null;
  high_intent_at?: string | null;
  tour_scheduled?: boolean | null;
  tour_completed?: boolean | null;
  tour_date?: string | null;
  became_member?: boolean | null;
  sms_opted_out?: boolean | null;
  day_pass_purchased_at?: string | null;
  source?: string | null;
};

export type CommandFreeWeek = {
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
};

export type AttentionKind =
  | "delivery_failure"
  | "automation_failure"
  | "unanswered"
  | "high_intent"
  | "tour_request"
  | "tour_no_show"
  | "trial_ending"
  | "day_pass_followup";

export type AttentionReason = {
  kind: AttentionKind;
  instruction: string;
  detail: string;
  rank: number;
  unresolvedAt: string;
};

export type LifecycleStage =
  | "Automation Running"
  | "Engaged"
  | "Tour Requested"
  | "Tour Booked"
  | "Trial / Day Pass Active"
  | "Joined"
  | "Nurture"
  | "Closed";

export type LeadCommandState = {
  stage: LifecycleStage;
  attention: AttentionReason | null;
  lastInbound: CommandMessage | null;
  lastOutbound: CommandMessage | null;
  lastOutboundSender: "Automated" | "Staff" | null;
  nextAutomatedStep: string;
};

const AUTOMATED_KINDS = new Set([
  "drip",
  "postvisit",
  "post_trial_nudge",
  "free_week_reactivation",
  "initial",
  "initial_lead_sms",
  "appointment_requested",
  "appointment_confirmed",
  "appointment_reminder",
]);

function ms(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function newest<T extends { created_at: string }>(rows: T[]): T | null {
  return rows.reduce<T | null>((latest, row) => {
    if (!latest || ms(row.created_at) > ms(latest.created_at)) return row;
    return latest;
  }, null);
}

function appointmentTime(row: CommandAppointment): string {
  return row.confirmed_time ?? row.suggested_time ?? row.requested_time;
}

function messageKind(message: CommandMessage): string {
  return message.metadata?.kind ?? "";
}

function isAutomated(message: CommandMessage): boolean {
  if (message.from_ai) return true;
  if (message.metadata?.sent_by === "staff" || messageKind(message) === "manual") return false;
  return AUTOMATED_KINDS.has(messageKind(message));
}

function latestAutomatedAfter(
  messages: CommandMessage[],
  after: string | null,
): CommandMessage | null {
  const afterMs = ms(after);
  return newest(
    messages.filter(
      (message) =>
        message.direction === "outbound" &&
        isAutomated(message) &&
        ms(message.created_at) >= afterMs,
    ),
  );
}

function hasReplyAfter(messages: CommandMessage[], after: string): boolean {
  const afterMs = ms(after);
  return messages.some(
    (message) => message.direction === "inbound" && ms(message.created_at) > afterMs,
  );
}

function isClosed(lead: CommandLead): boolean {
  return (
    lead.crm_status === "Lost Lead" ||
    lead.lead_type === "spam" ||
    lead.lead_type === "vendor_solicitation"
  );
}

function isJoined(lead: CommandLead): boolean {
  return (
    Boolean(lead.became_member) ||
    lead.crm_status === "Joined" ||
    lead.lead_type === "existing_member"
  );
}

function formatStepDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function nextAutomatedStep(lead: CommandLead, appointments: CommandAppointment[]): string {
  if (isJoined(lead) || isClosed(lead)) return "No automated follow-up";
  if (lead.sms_opted_out || lead.sequence_status === "opted_out") return "Stopped — SMS opted out";
  if (lead.sequence_status === "undeliverable") return "Stopped — phone cannot receive texts";

  const confirmed = newest(
    appointments.filter((appointment) => appointment.status === "confirmed"),
  );
  if (confirmed && ms(appointmentTime(confirmed)) > Date.now()) {
    return `Tour reminders for ${formatStepDate(appointmentTime(confirmed))}`;
  }
  if (lead.sequence_status === "paused") return "Paused — waiting on this conversation";
  if (lead.sequence_status === "completed") return "Sequence complete";
  if (lead.sequence_status === "pending") return "Initial automated message pending";
  if (lead.sequence_status !== "active") return "No automated step scheduled";

  const count = lead.followup_count ?? 0;
  const dayPass = Boolean(lead.day_pass_purchased_at);
  if (dayPass) {
    if (count <= 0) return "Post-visit check-in after the visit";
    if (count === 1) return "Membership follow-up after 24 hours";
    return "Post-visit sequence complete";
  }
  const days = [1, 3, 5, 7];
  if (count >= days.length) return "Sequence complete";
  return `Follow-up ${count + 1} · day ${days[count]}, between 9 AM–7 PM`;
}

function lifecycleStage(
  lead: CommandLead,
  freeWeek: CommandFreeWeek | null,
  appointments: CommandAppointment[],
  lastInbound: CommandMessage | null,
): LifecycleStage {
  if (isClosed(lead)) return "Closed";
  if (isJoined(lead)) return "Joined";
  if (lead.crm_status === "Nurture") return "Nurture";
  if (freeWeek?.active || Boolean(lead.day_pass_purchased_at)) return "Trial / Day Pass Active";
  const confirmed = appointments.some((appointment) => appointment.status === "confirmed");
  if (confirmed || lead.tour_scheduled) return "Tour Booked";
  const requested = appointments.some((appointment) =>
    ["pending", "alternative_suggested"].includes(appointment.status),
  );
  if (requested || lead.next_action === "Schedule Tour") return "Tour Requested";
  if (lead.sequence_status === "active" || lead.sequence_status === "pending") {
    return lastInbound ? "Engaged" : "Automation Running";
  }
  if (lastInbound || lead.crm_status === "Waiting on Response") return "Engaged";
  return "Nurture";
}

export function deriveLeadCommandState(
  lead: CommandLead,
  messages: CommandMessage[],
  appointments: CommandAppointment[],
  freeWeek: CommandFreeWeek | null,
  now: Date = new Date(),
): LeadCommandState {
  const outbound = messages.filter((message) => message.direction === "outbound");
  const inbound = messages.filter((message) => message.direction === "inbound");
  const lastOutbound = newest(outbound);
  const lastInbound = newest(inbound);
  const terminal = isJoined(lead) || isClosed(lead);
  const reasons: AttentionReason[] = [];

  if (!terminal) {
    const deliveryFailed =
      lead.sequence_status === "undeliverable" ||
      Boolean(
        lastOutbound &&
        (lastOutbound.status === "failed" ||
          lastOutbound.delivery_status === "failed" ||
          lastOutbound.delivery_status === "undelivered"),
      );
    if (deliveryFailed) {
      reasons.push({
        kind: "delivery_failure",
        instruction: "Call — text undelivered",
        detail: lastOutbound?.error_code
          ? `Carrier error ${lastOutbound.error_code}`
          : "The latest text did not reach this phone.",
        rank: 0,
        unresolvedAt: lastOutbound?.created_at ?? lead.created_at,
      });
    }

    const latestFailedAutomation = newest(
      outbound.filter(
        (message) =>
          isAutomated(message) &&
          (message.status === "failed" || message.delivery_status === "failed"),
      ),
    );
    const failedStillLatest =
      latestFailedAutomation &&
      (!lastOutbound || ms(latestFailedAutomation.created_at) >= ms(lastOutbound.created_at));
    const latestOutboundAnsweredInbound =
      lastInbound && lastOutbound && ms(lastOutbound.created_at) > ms(lastInbound.created_at);
    const validPause =
      lead.sms_opted_out ||
      lead.sequence_status === "opted_out" ||
      lead.crm_status === "Nurture" ||
      appointments.some((appointment) => appointment.status === "confirmed") ||
      Boolean(latestOutboundAnsweredInbound);
    if (
      !deliveryFailed &&
      (failedStillLatest || (lead.sequence_status === "paused" && !validPause))
    ) {
      reasons.push({
        kind: "automation_failure",
        instruction: "Fix automation",
        detail: failedStillLatest
          ? "The latest automated message failed."
          : "The sequence is paused without a clear reason.",
        rank: 0,
        unresolvedAt: latestFailedAutomation?.created_at ?? lead.last_sms_at ?? lead.created_at,
      });
    }

    if (
      lastInbound &&
      (!lastOutbound || ms(lastInbound.created_at) > ms(lastOutbound.created_at))
    ) {
      reasons.push({
        kind: "unanswered",
        instruction: "Reply to question",
        detail: lastInbound.body,
        rank: 1,
        unresolvedAt: lastInbound.created_at,
      });
    }

    const staffActionAfterIntent = messages.some(
      (message) =>
        message.direction === "outbound" &&
        !isAutomated(message) &&
        ms(message.created_at) > ms(lead.high_intent_at),
    );
    if (lead.high_intent && !staffActionAfterIntent) {
      reasons.push({
        kind: "high_intent",
        instruction: "Reply — ready to buy",
        detail: "This person has signaled they are ready to take the next step.",
        rank: 2,
        unresolvedAt: lead.high_intent_at ?? lastInbound?.created_at ?? lead.created_at,
      });
    }

    const pendingTour = newest(
      appointments.filter((appointment) =>
        ["pending", "alternative_suggested"].includes(appointment.status),
      ),
    );
    const visitIntentWithoutBooking =
      lead.next_action === "Schedule Tour" &&
      !appointments.some((appointment) => appointment.status === "confirmed");
    if (pendingTour || visitIntentWithoutBooking) {
      reasons.push({
        kind: "tour_request",
        instruction: "Book requested tour",
        detail: pendingTour
          ? `Requested ${formatStepDate(appointmentTime(pendingTour))}`
          : "Visit intent is waiting for a confirmed time.",
        rank: 3,
        unresolvedAt: pendingTour?.created_at ?? lead.created_at,
      });
    }

    const missedTour = newest(
      appointments.filter(
        (appointment) =>
          appointment.status === "confirmed" && ms(appointmentTime(appointment)) < now.getTime(),
      ),
    );
    if (missedTour && !lead.tour_completed) {
      reasons.push({
        kind: "tour_no_show",
        instruction: "Follow up — tour no-show",
        detail: `Tour was ${formatStepDate(appointmentTime(missedTour))}`,
        rank: 4,
        unresolvedAt: appointmentTime(missedTour),
      });
    }

    const hasMembershipSetup = appointments.some(
      (appointment) =>
        appointment.status === "confirmed" && ms(appointmentTime(appointment)) >= now.getTime(),
    );
    if (
      freeWeek?.active &&
      freeWeek.endsAt &&
      chicagoDateOf(freeWeek.endsAt) === chicagoDateOf(now) &&
      !hasMembershipSetup
    ) {
      const conversionOutbound = latestAutomatedAfter(messages, freeWeek.startsAt);
      if (!conversionOutbound || !hasReplyAfter(messages, conversionOutbound.created_at)) {
        reasons.push({
          kind: "trial_ending",
          instruction: "Follow up — trial ends today",
          detail: "No membership setup or reply is on record.",
          rank: 5,
          unresolvedAt: freeWeek.endsAt,
        });
      }
    }

    if (
      lead.day_pass_purchased_at &&
      chicagoDateOf(lead.day_pass_purchased_at) < chicagoDateOf(now)
    ) {
      const postVisitOutbound = newest(
        outbound.filter(
          (message) =>
            messageKind(message) === "postvisit" &&
            ms(message.created_at) >= ms(lead.day_pass_purchased_at),
        ),
      );
      if (postVisitOutbound && !hasReplyAfter(messages, postVisitOutbound.created_at)) {
        reasons.push({
          kind: "day_pass_followup",
          instruction: "Follow up — day pass visit",
          detail: "They checked in and have not replied to the post-visit sequence.",
          rank: 6,
          unresolvedAt: postVisitOutbound.created_at,
        });
      }
    }
  }

  reasons.sort((a, b) => a.rank - b.rank || ms(a.unresolvedAt) - ms(b.unresolvedAt));
  return {
    stage: lifecycleStage(lead, freeWeek, appointments, lastInbound),
    attention: reasons[0] ?? null,
    lastInbound,
    lastOutbound,
    lastOutboundSender: lastOutbound ? (isAutomated(lastOutbound) ? "Automated" : "Staff") : null,
    nextAutomatedStep: nextAutomatedStep(lead, appointments),
  };
}

export function lifecycleRank(stage: LifecycleStage): number {
  const order: LifecycleStage[] = [
    "Automation Running",
    "Engaged",
    "Tour Requested",
    "Tour Booked",
    "Trial / Day Pass Active",
    "Nurture",
    "Joined",
    "Closed",
  ];
  return order.indexOf(stage);
}
