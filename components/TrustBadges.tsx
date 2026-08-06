const badges = [
  { icon: "🔒", label: "Private", detail: "Files never leave your browser" },
  { icon: "⚡", label: "Fast", detail: "No uploads, no waiting in a queue" },
  { icon: "💸", label: "Free", detail: "No account, no watermark, no limit" },
];

export default function TrustBadges() {
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      {badges.map((b) => (
        <div key={b.label} className="rounded-xl border border-black/10 dark:border-white/10 p-3 sm:p-4">
          <div className="text-2xl mb-1">{b.icon}</div>
          <div className="font-semibold text-sm">{b.label}</div>
          <div className="text-xs text-zinc-500 mt-0.5 hidden sm:block">{b.detail}</div>
        </div>
      ))}
    </div>
  );
}
