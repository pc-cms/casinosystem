import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export const PageHeader = ({ icon: Icon, title, subtitle, children }: PageHeaderProps) => (
  <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
    <div className="flex items-center gap-3 min-w-0">
      {Icon && (
        <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </div>
    {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
  </div>
);
