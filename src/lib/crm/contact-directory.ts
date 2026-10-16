export type DirectoryContact = {
  name: string;
  email: string;
  phone: string | null;
  contact_type: string | null;
  review_flag: boolean;
  lead_type: string;
  status: string | null;
  tags: string[];
  day_pass_purchased_at?: string | null;
};

export const SMART_LISTS = [
  { id: "all", label: "All contacts" },
  { id: "prospects", label: "Prospects" },
  { id: "daypass", label: "Active Day Passes" },
  { id: "members", label: "Members" },
  { id: "former", label: "Former Members" },
  { id: "vendors", label: "Vendor / Non-Sales" },
  { id: "review", label: "Migration Review" },
  { id: "excluded", label: "Test / Spam" },
] as const;
export type SmartList = (typeof SMART_LISTS)[number]["id"];

export function isVendor(c: { contact_type: string | null; lead_type?: string }) {
  return c.contact_type === "Vendor/Non-Sales" || c.lead_type === "vendor_solicitation";
}

export function isTestOrSpam(c: DirectoryContact) {
  return c.contact_type === "Spam" || c.lead_type === "spam" || c.status?.toLowerCase() === "spam" ||
    /\btest\b/i.test(c.name) || c.tags.some((t) => /^(test|spam)$/i.test(t));
}

export function inSmartList(c: DirectoryContact, list: SmartList) {
  if (list === "all") return true;
  if (list === "review") return c.review_flag;
  if (list === "excluded") return isTestOrSpam(c);
  if (list === "daypass") return !isTestOrSpam(c) && c.contact_type !== "Member" && !!c.day_pass_purchased_at &&
    Date.now() - new Date(c.day_pass_purchased_at).getTime() < 14 * 86400000;
  const types = { prospects: "Prospect", members: "Member", former: "Former Member", vendors: "Vendor/Non-Sales" };
  return !isTestOrSpam(c) && c.contact_type === types[list];
}

export function matchesContactSearch(c: DirectoryContact, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  return c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle) ||
    (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits));
}