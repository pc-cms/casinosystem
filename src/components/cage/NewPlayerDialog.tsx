import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { RegisterTab } from "@/pages/Reception";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const NewPlayerDialog = ({ open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New Player Registration"
      className="max-w-2xl"
    >
      <div className="max-h-[80vh] overflow-y-auto -mx-1 px-1">
        <RegisterTab
          onRegistered={() => {
            qc.invalidateQueries({ queryKey: ["players"] });
            onOpenChange(false);
          }}
        />
      </div>
    </ResponsiveDialog>
  );
};

export default NewPlayerDialog;
