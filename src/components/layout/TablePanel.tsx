import { ReactNode } from "react";

interface TablePanelProps {
  children: ReactNode;
  className?: string;
}

export const TablePanel = ({ children, className }: TablePanelProps) => (
  <div className={`border border-border rounded-md overflow-hidden bg-card ${className ?? ""}`}>
    {children}
  </div>
);

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
}

export const EmptyState = ({ icon, title = "No data", description = "Nothing to show for the selected filters." }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    {icon && <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">{icon}</div>}
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="text-xs text-muted-foreground mt-1">{description}</p>
  </div>
);
