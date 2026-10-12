import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type PendingMove = { opportunityId: string; name: string; stage: "Joined — Won" | "Closed — Lost" };

export function StageMoveDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingMove | null;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const won = pending?.stage === "Joined — Won";
  return (
    <AlertDialog
      open={!!pending}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {won ? `Mark ${pending?.name} as Joined?` : `Close ${pending?.name} as Lost?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {won ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>This will run these automations once:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Mark them as a member with today's join date (if not already)</li>
                  <li>Set CRM status to Joined</li>
                  <li>Stop their automated follow-up texts</li>
                  <li>
                    Send the member welcome text — only if they have a phone, haven't opted out, and
                    have never received it before
                  </li>
                </ul>
                <p>A won opportunity can't be reopened.</p>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>A lost opportunity can't be reopened. A future form submission starts a new one.</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Reason (required) — e.g. price, moved away, chose another gym"
                  className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!won && !reason.trim()}
            onClick={() => {
              onConfirm(won ? undefined : reason.trim());
              setReason("");
            }}
          >
            {won ? "Confirm Joined" : "Close as Lost"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
