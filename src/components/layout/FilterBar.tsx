import { ReactNode } from "react";

interface FilterBarProps {
  presets?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export const FilterBar = ({ presets, search, filters, right, className }: FilterBarProps) => (
  <div className={`flex flex-wrap items-center gap-2 mb-3 p-2 rounded-md bg-card border border-border ${className ?? ""}`}>
    {search && <div className="flex items-center">{search}</div>}
    {presets && <div className="flex items-center">{presets}</div>}
    {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
    {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
  </div>
);
