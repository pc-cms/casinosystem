import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useActiveShift } from "@/hooks/use-shift";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pencil } from "lucide-react";
import EditOpeningChipsDialog from "@/components/cage/EditOpeningChipsDialog";

const EditOpeningChipsPage = () => {
  const nav = useNavigate();
  const { id } = useParams();
  const { data: shift, isLoading } = useActiveShift();
  const [open, setOpen] = useState(true);

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader icon={Pencil} title="Edit Opening Chips" subtitle="Loading…" />
      </PageShell>
    );
  }
  if (!shift || (id && id !== shift.id)) {
    nav("/cage", { replace: true });
    return null;
  }
  return (
    <PageShell>
      <PageHeader icon={Pencil} title="Edit Opening Chips" subtitle="Manager-only correction" />
      <EditOpeningChipsDialog
        shift={shift}
        open={open}
        onClose={() => { setOpen(false); nav("/cage"); }}
      />
    </PageShell>
  );
};

export default EditOpeningChipsPage;
