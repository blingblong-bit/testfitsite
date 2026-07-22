export function SmsConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-primary"
      />
      <span className="text-xs leading-relaxed text-muted-foreground">
        Yes, I'd like to receive text messages from FIT Beyond Plus about my
        inquiry, appointments, and membership updates. Message frequency
        varies. Message and data rates may apply. Reply STOP to opt out or
        HELP for help. View our{" "}
        <a href="/terms" className="underline hover:text-foreground">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </a>
        .
      </span>
    </label>
  );
}
