import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const ALLOWED_SOURCES = [
  "Website",
  "Walk-In",
  "Phone Call",
  "Google Business",
  "Facebook",
  "Instagram",
  "Referral",
  "Day Pass",
  "MCP",
  "Other",
] as const;

export default defineTool({
  name: "submit_inquiry",
  title: "Submit inquiry",
  description:
    "Submit a new lead / inquiry to FIT Beyond Plus (name, email, optional phone, interest, and message). Use when a prospective member wants the gym to follow up.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Full name of the person."),
    email: z.string().trim().email().describe("Contact email."),
    phone: z.string().trim().optional().describe("Optional phone number."),
    interest: z
      .string()
      .trim()
      .optional()
      .describe("What they are interested in (e.g. Membership, Personal Training, Classes)."),
    message: z.string().trim().optional().describe("Message from the person."),
    source: z
      .enum(ALLOWED_SOURCES)
      .optional()
      .describe("Lead source. Defaults to 'MCP' when submitted through an AI assistant."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, email, phone, interest, message, source }) => {
    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      return {
        content: [{ type: "text", text: "Server is not configured to accept inquiries." }],
        isError: true,
      };
    }
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from("leads").insert({
      source: source ?? "MCP",
      name,
      email,
      phone: phone ?? null,
      interest: interest ?? null,
      message: message ?? null,
    });

    if (error) {
      return {
        content: [{ type: "text", text: `Could not submit inquiry: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: "Inquiry received. The FIT Beyond Plus team will follow up shortly.",
        },
      ],
      structuredContent: { ok: true },
    };
  },
});
