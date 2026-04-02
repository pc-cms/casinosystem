import { Lock, Unlock } from "lucide-react";

const LockableSection = ({
  title, locked, onToggleLock, children,
}: {
  title: string; locked: boolean; onToggleLock: () => void; children: React.ReactNode;
}) => (
  <section className={`rounded-lg border px-3 py-2 space-y-1.5 transition-colors ${locked ? "border-primary/40 bg-primary/5" : "border-border bg-background/40"}`}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">{title}</p>
      <button
        type="button"
        onClick={onToggleLock}
        className={`flex items-center gap-0.5 text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors ${
          locked
            ? "bg-primary/10 text-primary"
            : "bg-muted/50 text-muted-foreground hover:bg-muted"
        }`}
      >
        {locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
        {locked ? "Locked" : "Lock"}
      </button>
    </div>
    <div className={locked ? "opacity-50 pointer-events-none select-none" : ""}>{children}</div>
  </section>
);

export default LockableSection;
