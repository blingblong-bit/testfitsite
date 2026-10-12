import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Users, Flag, Search, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contactLookupQuery, fmtChicago } from "@/lib/crm/queries";
import { SMART_LISTS, inSmartList, isTestOrSpam, matchesContactSearch, type SmartList } from "@/lib/crm/contact-directory";

export const Route = createFileRoute("/_authenticated/crm/contacts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(contactLookupQuery),
  head: () => ({ meta: [
    { title: "Contacts & Smart Lists — FIT CRM" },
    { name: "description", content: "FIT Beyond Plus contact directory, relationship filters, and Migration Review Smart List." },
    { property: "og:title", content: "Contacts & Smart Lists — FIT CRM" },
    { property: "og:description", content: "FIT Beyond Plus contact directory, relationship filters, and Migration Review Smart List." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  pendingComponent: () => <p className="p-6 text-muted-foreground">Loading contacts…</p>,
  errorComponent: ({ reset }) => <div className="p-6 space-y-3"><p className="text-destructive">Could not load contacts.</p><Button variant="outline" onClick={reset}>Try again</Button></div>,
  component: ContactsPage,
});

const selectClass = "h-10 w-full min-w-0 rounded-md border border-border bg-secondary px-3 text-sm sm:w-auto sm:max-w-56";

function ContactsPage() {
  const { data: contacts } = useSuspenseQuery(contactLookupQuery);
  const navigate = useNavigate();
  const [list, setList] = useState<SmartList>("all");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [tag, setTag] = useState("");
  const types = Array.from(new Set(contacts.map((c) => c.contact_type ?? "Unclassified"))).sort();
  const sources = Array.from(new Set(contacts.map((c) => c.original_source ?? c.source).filter(Boolean))).sort();
  const tags = Array.from(new Set(contacts.flatMap((c) => c.tags))).sort();
  const selected = SMART_LISTS.find((s) => s.id === list) ?? SMART_LISTS[0];
  const globalSearch = !!query.trim();
  const visible = contacts.filter((c) => {
    // Global search is never constrained by a Smart List or directory filters.
    if (globalSearch) return matchesContactSearch(c, query);
    return inSmartList(c, list) && (!type || (c.contact_type ?? "Unclassified") === type) &&
      (!source || (c.original_source ?? c.source) === source) && (!tag || c.tags.includes(tag));
  });
  const excluded = contacts.filter(isTestOrSpam).length;
  const chips = [
    ...(list !== "all" ? [{ label: `Smart List: ${selected.label}`, clear: () => setList("all") }] : []),
    ...(query ? [{ label: `Search: ${query}`, clear: () => setQuery("") }] : []),
    ...(type ? [{ label: `Type: ${type}`, clear: () => setType("") }] : []),
    ...(source ? [{ label: `Source: ${source}`, clear: () => setSource("") }] : []),
    ...(tag ? [{ label: `Tag: ${tag}`, clear: () => setTag("") }] : []),
  ];
  function clearFilters() { setList("all"); setType(""); setSource(""); setTag(""); }
  function clearAll() { clearFilters(); setQuery(""); }
  function chooseList(value: SmartList) { setList(value); setQuery(""); setType(""); setSource(""); setTag(""); }
  const open = (id: string) => navigate({ to: "/crm/contacts", search: { contact: id, tab: "details" } });

  return <div className="p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl md:text-3xl">Contacts</h1><p className="mt-1 text-sm text-muted-foreground" aria-label="Contact directory totals">{contacts.length} total contacts · {excluded} test / spam</p></div>
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input aria-label="Global contact search" placeholder="Search every contact" value={query} onChange={(e) => { setQuery(e.target.value); clearFilters(); }} className="h-11 w-full rounded-md border border-border bg-secondary pl-9 pr-10 text-sm focus:outline-none focus:border-primary" />
        {query && <Button size="icon" variant="ghost" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-1 top-1 h-9 w-9"><X /></Button>}
      </div>
    </header>

    <section aria-label="Smart Lists" className="mt-6 border-y border-border py-4">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Smart Lists</h2>
      <div className="hidden sm:flex flex-wrap gap-2">
        {SMART_LISTS.map((s) => <Button key={s.id} variant={list === s.id && !globalSearch ? "secondary" : "ghost"} aria-pressed={list === s.id && !globalSearch} onClick={() => chooseList(s.id)} className="h-10 gap-2">
          {s.id === "review" ? <Flag className="text-destructive" /> : s.id === "all" ? <Users /> : null}
          {s.label}<span className="text-xs text-muted-foreground tabular-nums">{contacts.filter((c) => inSmartList(c, s.id)).length}</span>
        </Button>)}
      </div>
      <select aria-label="Smart List" className={`${selectClass} sm:hidden`} value={list} onChange={(e) => chooseList(e.target.value as SmartList)}>
        {SMART_LISTS.map((s) => <option value={s.id} key={s.id}>{s.label} · {contacts.filter((c) => inSmartList(c, s.id)).length}</option>)}
      </select>
    </section>

    <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap" aria-label="Contact filters">
      <select aria-label="Contact type filter" value={type} onChange={(e) => { setQuery(""); setType(e.target.value); }} className={selectClass}><option value="">All contact types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
      <select aria-label="Original source filter" value={source} onChange={(e) => { setQuery(""); setSource(e.target.value); }} className={selectClass}><option value="">All original sources</option>{sources.map((s) => <option key={s}>{s}</option>)}</select>
      <select aria-label="Tag filter" value={tag} onChange={(e) => { setQuery(""); setTag(e.target.value); }} className={selectClass}><option value="">All tags</option>{tags.map((t) => <option key={t}>{t}</option>)}</select>
    </div>
    {chips.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Active contact filters">
      {chips.map((c) => <Button key={c.label} variant="outline" size="sm" aria-label={`Remove ${c.label}`} onClick={c.clear} className="h-auto min-h-8 max-w-full whitespace-normal text-left text-primary"><span className="break-all">{c.label}</span><X /></Button>)}
      <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground underline">Clear all</Button>
    </div>}

    <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
      <h2 className="text-lg font-medium" aria-label="Current contact context">{globalSearch ? "Global search · All contacts" : selected.label}</h2>
      <span className="text-sm text-muted-foreground" aria-label="Visible contact count">{visible.length} of {contacts.length} contacts</span>
    </div>
    {!visible.length ? <div className="border-y border-border py-10 text-center"><p className="text-muted-foreground">No contacts match.</p><Button variant="link" onClick={clearAll}>Clear all</Button></div> : <>
      <div className="sm:hidden divide-y divide-border border-y border-border" aria-label="Contact directory">
        {visible.map((c) => <Button key={c.id} variant="ghost" onClick={() => open(c.id)} className="h-auto min-h-24 w-full justify-between gap-3 whitespace-normal px-0 py-4 text-left">
          <span className="min-w-0 space-y-1"><span className="block break-words font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.contact_type ?? "Unclassified"} · {c.phone || "No phone"}</span>
            <span className="block text-xs text-muted-foreground break-all">{c.original_source ?? c.source}</span>
            {c.review_flag && <span className="block text-xs text-destructive">Migration Review · Held outside pipeline</span>}
            {isTestOrSpam(c) && <span className="block text-xs text-muted-foreground">Test / Spam · Excluded from sales</span>}
          </span><ChevronRight className="text-muted-foreground" />
        </Button>)}
      </div>
      <div className="hidden sm:block overflow-x-auto border-y border-border">
        <table className="w-full text-sm" aria-label="Contact directory"><thead className="text-xs text-muted-foreground bg-card text-left"><tr><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Relationship</th><th className="px-3 py-3">Original source</th><th className="px-3 py-3">Last activity</th></tr></thead>
          <tbody>{visible.map((c) => <tr key={c.id} className="border-t border-border hover:bg-secondary/40">
            <td className="px-3 py-3"><Button variant="ghost" onClick={() => open(c.id)} className="h-auto max-w-72 whitespace-normal break-words justify-start px-0 py-1 text-left text-primary">{c.name}</Button><p className="text-xs text-muted-foreground">{c.phone || "No phone"}</p><p className="text-xs text-muted-foreground break-all">{c.email}</p></td>
            <td className="px-3 py-3"><p>{c.contact_type ?? "Unclassified"}</p>{c.review_flag && <p className="mt-1 text-xs text-destructive">Migration Review · Held outside pipeline</p>}{isTestOrSpam(c) && <p className="mt-1 text-xs text-muted-foreground">Test / Spam · Excluded from sales</p>}</td>
            <td className="px-3 py-3 text-muted-foreground">{c.original_source ?? c.source}</td>
            <td className="px-3 py-3 text-muted-foreground">{fmtChicago([c.last_response_at, c.last_sms_at, c.last_contacted_at].filter((s): s is string => !!s).sort().at(-1) ?? c.created_at)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </div>;
}