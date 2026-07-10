import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getGymInfo from "./tools/get-gym-info";
import listOfferings from "./tools/list-offerings";
import submitInquiry from "./tools/submit-inquiry";

// Require OAuth on the MCP server. Tokens are verified against the project's
// Supabase Auth issuer; callers must present a valid access token whose
// audience includes "authenticated".
const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const issuerUrl = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/auth/v1` : "";

export default defineMcp({
  name: "fit-beyond-plus-mcp",
  title: "FIT Beyond Plus",
  version: "0.1.0",
  instructions:
    "Tools for FIT Beyond Plus, a gym in Tullahoma, TN. Use `get_gym_info` for address/hours/phone, `list_offerings` for memberships/training/classes with links, and `submit_inquiry` to record a new lead so staff can follow up.",
  tools: [getGymInfo, listOfferings, submitInquiry],
  auth: issuerUrl
    ? auth.oauth.issuer({
        issuer: issuerUrl,
        jwksUri: `${issuerUrl}/.well-known/jwks.json`,
        acceptedAudiences: ["authenticated"],
        resourceName: "FIT Beyond Plus MCP",
      })
    : undefined,
});
