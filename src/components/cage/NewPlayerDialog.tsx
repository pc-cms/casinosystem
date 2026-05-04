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
      size="2xl"
    >
      <RegisterTab
        onRegistered={() => {
          qc.invalidateQueries({ queryKey: ["players"] });
          onOpenChange(false);
        }}
      />
    </ResponsiveDialog>
  );
};

export default NewPlayerDialog;
