import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  onExport: () => void;
  disabled?: boolean;
  label?: string;
}

export const ExportButton = ({ onExport, disabled, label = "Export Excel" }: ExportButtonProps) => (
  <Button size="sm" variant="outline" onClick={onExport} disabled={disabled} className="h-9 gap-2">
    <FileSpreadsheet className="w-4 h-4" />
    {label}
  </Button>
);
