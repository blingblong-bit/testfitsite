import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { moveOpportunityStage, type PipelineStage } from "./opportunities.functions";
import { boardQuery, type BoardOpportunity } from "./queries";
import type { PendingMove } from "@/components/crm/StageMoveDialog";

/** Stage moves with optimistic board updates and Won/Lost confirmation. */
export function useMoveStage() {
  const qc = useQueryClient();
  const move = useServerFn(moveOpportunityStage);
  const [pending, setPending] = useState<PendingMove | null>(null);

  const mutation = useMutation({
    mutationFn: async (v: { id: string; stage: PipelineStage; reason?: string; confirmed?: boolean }) => {
      const r = await move({
        data: { opportunity_id: v.id, stage: v.stage, reason: v.reason, confirmed: v.confirmed },
      });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: boardQuery.queryKey });
      const prev = qc.getQueryData<BoardOpportunity[]>(boardQuery.queryKey);
      qc.setQueryData<BoardOpportunity[]>(boardQuery.queryKey, (rows) =>
        rows?.map((o) =>
          o.id === v.id
            ? {
                ...o,
                stage: v.stage,
                status: v.stage === "Joined — Won" ? "won" : v.stage === "Closed — Lost" ? "lost" : "open",
                last_activity_at: new Date().toISOString(),
              }
            : o,
        ),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardQuery.queryKey, ctx.prev);
      const msg = err instanceof Error ? err.message : "Move failed";
      toast.error(msg === "closed_opportunity" ? "Won or lost opportunities can't be reopened." : `Could not move: ${msg}`);
    },
    onSuccess: (r) => {
      if ("welcome" in r && r.welcome === "sent") toast.success("Marked Joined — welcome text sent");
      else if ("welcome" in r && r.welcome) toast.success("Marked Joined");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["crm"] });
    },
  });

  function requestMove(opp: { id: string; status: string; contact: { name: string } | null }, stage: PipelineStage) {
    if (opp.status !== "open") {
      toast.error("Won or lost opportunities can't be reopened.");
      return;
    }
    if (stage === "Joined — Won" || stage === "Closed — Lost") {
      setPending({ opportunityId: opp.id, name: opp.contact?.name ?? "this contact", stage });
      return;
    }
    mutation.mutate({ id: opp.id, stage });
  }

  function confirm(reason?: string) {
    if (!pending) return;
    mutation.mutate({ id: pending.opportunityId, stage: pending.stage, reason, confirmed: true });
    setPending(null);
  }

  return { requestMove, pending, cancel: () => setPending(null), confirm };
}
