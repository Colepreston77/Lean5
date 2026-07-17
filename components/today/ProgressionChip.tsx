import type { ProgressionHint, HintColor } from "@/lib/engine/progression";

const STYLES: Record<HintColor, string> = {
  green: "bg-[var(--green-bg)] text-[var(--green)]",
  yellow: "bg-[var(--yellow-bg)] text-[var(--yellow)]",
  blue: "bg-[var(--blue-bg)] text-[var(--blue)]",
  neutral: "bg-[var(--neutral-bg)] text-ink-soft",
  grey: "bg-[var(--neutral-bg)] text-ink-faint",
};

export default function ProgressionChip({ hint }: { hint: ProgressionHint }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[hint.color]}`}>
      {hint.text}
    </span>
  );
}
