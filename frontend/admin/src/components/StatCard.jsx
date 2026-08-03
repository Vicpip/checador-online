export default function StatCard({ label, value, icon: Icon, tone = "primary" }) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    accent: "bg-accent/10 text-accent",
    danger: "bg-danger/10 text-danger",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {Icon && (
          <span className={`rounded-lg p-2 ${toneClasses[tone]}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
