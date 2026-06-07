import type { ReactNode } from "react";

interface DarkPanelProps {
  label?: string;
  children?: ReactNode;
  minHeight?: number;
  className?: string;
}

/**
 * Dark mock browser/device panel. Replaces the previous white MockupFrame.
 * Used for screenshot placeholders and command-center composites — never
 * shows a white SaaS dashboard.
 */
export function DarkPanel({ label, children, minHeight = 200, className }: DarkPanelProps) {
  return (
    <div className={`l-panel ${className ?? ""}`}>
      <div className="l-panel__chrome">
        <span className="l-panel__dot" />
        <span className="l-panel__dot" />
        <span className="l-panel__dot" />
        {label && <span className="l-panel__label">{label}</span>}
      </div>
      <div className="l-panel__body" style={{ minHeight }}>
        {children}
      </div>
    </div>
  );
}
