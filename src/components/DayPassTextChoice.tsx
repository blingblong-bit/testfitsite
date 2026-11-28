export function DayPassTextChoice({ value, onChange }: {
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-sm font-semibold">Text messages (optional)</legend>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
        <input type="radio" name="day-pass-texts" required checked={value === true}
          onChange={() => onChange(true)} className="mt-1 h-5 w-5 shrink-0 accent-primary" />
        <span className="text-sm">Yes, I'd like to receive text messages from FIT Beyond Plus about my visit, appointments, and membership updates.</span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
        <input type="radio" name="day-pass-texts" required checked={value === false}
          onChange={() => onChange(false)} className="mt-1 h-5 w-5 shrink-0 accent-primary" />
        <span className="text-sm">No, I would not like to receive texts.</span>
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Text consent is not required to buy a day pass. Message frequency varies. Message and data rates may apply.
        Reply STOP to opt out or HELP for help. <a href="/terms" className="underline">Terms</a> and{" "}
        <a href="/privacy" className="underline">Privacy Policy</a>.
      </p>
    </fieldset>
  );
}