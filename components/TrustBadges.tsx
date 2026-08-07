import { Lock, Zap, DollarSign } from "lucide-react";

const badges = [
  { Icon: Lock, label: "Private", detail: "Files never leave your browser" },
  { Icon: Zap, label: "Fast", detail: "No uploads, no waiting in a queue" },
  { Icon: DollarSign, label: "Free", detail: "No account, no watermark, no limit" },
];

export default function TrustBadges() {
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      {badges.map((b) => (
        <div key={b.label} className="rounded-xl border border-black/10 dark:border-white/10 p-3 sm:p-4">
          <b.Icon className="h-6 w-6 mx-auto mb-1 text-red-600" aria-hidden="true" />
          <div className="font-semibold text-sm">{b.label}</div>
          <div className="text-xs text-zinc-500 mt-0.5 hidden sm:block">{b.detail}</div>
        </div>
      ))}
    </div>
  );
}
