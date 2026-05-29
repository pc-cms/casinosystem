import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGrid, FormField } from "@/components/ui/form-grid";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { usePlayers } from "@/hooks/use-players";
import { useOpenPosTab } from "@/hooks/use-pos-tabs";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  casinoId: string;
  shiftId: string;
  userId: string;
  onCreated: (tabId: string) => void;
}

export const NewTabDialog = ({ open, onOpenChange, casinoId, shiftId, userId, onCreated }: Props) => {
  const { data: players = [] } = usePlayers();
  const openTab = useOpenPosTab();
  const [tab, setTab] = useState<"player" | "walkin">("player");
  const [search, setSearch] = useState("");
  const [walkinLabel, setWalkinLabel] = useState("");

  const filtered = (players as any[])
    .filter((p) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const hay = `${p.first_name ?? ""} ${p.last_name ?? ""} ${p.nickname ?? ""}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 30);

  const createForPlayer = async (player: any) => {
    try {
      const name = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
      const result = await openTab.mutateAsync({
        casino_id: casinoId,
        shift_id: shiftId,
        opened_by_user_id: userId,
        player_id: player.id,
        player_name: name,
      });
      toast({ title: "Tab opened" });
      onCreated(result.id);
      onOpenChange(false);
      setSearch("");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const createWalkin = async () => {
    if (!walkinLabel.trim()) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    try {
      const result = await openTab.mutateAsync({
        casino_id: casinoId,
        shift_id: shiftId,
        opened_by_user_id: userId,
        walkin_label: walkinLabel.trim(),
      });
      toast({ title: "Walk-in tab opened" });
      onCreated(result.id);
      onOpenChange(false);
      setWalkinLabel("");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="New tab" size="lg">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="player">Player</TabsTrigger>
          <TabsTrigger value="walkin">Bar walk-in</TabsTrigger>
        </TabsList>

        <TabsContent value="player" className="space-y-3 mt-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or nickname…"
            autoFocus
          />
          <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">No matches.</div>
            ) : (
              filtered.map((p) => {
                const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
                const nick = p.nickname ? ` "${p.nickname}"` : "";
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => createForPlayer(p)}
                    className="w-full text-left px-3 py-3 hover:bg-accent/40 transition-colors"
                    disabled={openTab.isPending}
                  >
                    <div className="font-medium">{full}{nick}</div>
                    {p.phone && (
                      <div className="text-xs text-muted-foreground">{p.phone}</div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="walkin" className="mt-3">
          <FormGrid>
            <FormField span={12} label="Label" required hint="e.g. Bar 2, Floor, Table 5">
              <Input value={walkinLabel} onChange={(e) => setWalkinLabel(e.target.value)} autoFocus />
            </FormField>
          </FormGrid>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={createWalkin} disabled={openTab.isPending}>
              {openTab.isPending ? "Opening…" : "Open walk-in tab"}
            </Button>
          </ResponsiveDialogFooter>
        </TabsContent>
      </Tabs>
    </ResponsiveDialog>
  );
};

export default NewTabDialog;
