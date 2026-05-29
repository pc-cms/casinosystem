import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGrid, FormField } from "@/components/ui/form-grid";
import { toast } from "@/hooks/use-toast";
import { useOpenPosShift, suggestShiftType, type PosShiftType } from "@/hooks/use-pos-shift";
import { formatNumberSpaces } from "@/lib/currency";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  casinoId: string;
  userId: string;
}

const SEGMENTS: { value: PosShiftType; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

export const OpenShiftCard = ({ casinoId, userId }: Props) => {
  const open = useOpenPosShift();
  const [cash, setCash] = useState("0");
  const [shiftType, setShiftType] = useState<PosShiftType>(suggestShiftType());

  const handle = async () => {
    const n = Number(cash);
    if (!Number.isFinite(n) || n < 0) {
      toast({ title: "Opening cash must be a non-negative number", variant: "destructive" });
      return;
    }
    try {
      await open.mutateAsync({
        casino_id: casinoId,
        waiter_user_id: userId,
        opening_cash: Math.round(n),
        shift_type: shiftType,
      });
      toast({ title: `${shiftType[0].toUpperCase()}${shiftType.slice(1)} shift opened` });
    } catch (e: any) {
      toast({ title: "Failed to open shift", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 rounded-md border border-border bg-card space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Open POS shift</h2>
        <p className="text-sm text-muted-foreground">
          Choose your shift segment and enter the cash you have in the POS register.
        </p>
      </div>

      <FormGrid>
        <FormField span={12} label="Shift segment" required>
          <Tabs value={shiftType} onValueChange={(v) => setShiftType(v as PosShiftType)}>
            <TabsList className="grid grid-cols-3 w-full">
              {SEGMENTS.map((s) => (
                <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </FormField>

        <FormField span={12} label="Opening cash (TZS)" required>
          <Input
            type="number"
            inputMode="numeric"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            className="text-lg"
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-1">
            Preview: {formatNumberSpaces(Number(cash) || 0)} TZS
          </p>
        </FormField>
      </FormGrid>

      <Button className="w-full h-12 text-base" onClick={handle} disabled={open.isPending}>
        {open.isPending ? "Opening…" : "Open shift"}
      </Button>
    </div>
  );
};

export default OpenShiftCard;
