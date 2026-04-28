import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  /** Optional context shown to the right of the title (e.g. casino badge, role, period). */
  context?: ReactNode;
  /** Action buttons rendered on the right side of the header. */
  children?: ReactNode;
  /** Optional row rendered immediately below the header (filters, tabs, segmented control). */
  belowHeader?: ReactNode;
  className?: string;
}

/**
 * Unified page header used across ALL pages.
 * - Title: text-lg / semibold (do NOT use other sizes for page titles)
 * - Optional icon badge: 9x9 with primary tint
 * - Right slot for primary/outline actions
 * - Bottom border separates from content
 */
export const PageHeader = ({
  icon: Icon,
  title,
  subtitle,
  context,
  children,
  belowHeader,
  className,
}: PageHeaderProps) => (
  <div className={cn("mb-4 pb-3 border-b border-border space-y-3", className)}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && (
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
              {title}
            </h1>
            {context && <div className="shrink-0 flex items-center gap-2">{context}</div>}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
    {belowHeader && <div className="flex items-center gap-2 flex-wrap">{belowHeader}</div>}
  </div>
);
