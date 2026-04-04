import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { useInterCasinoTransfers, useCreateTransfer, useConfirmTransfer, useRejectTransfer } from "@/hooks/use-transfers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRight, Check, X, Plus, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { formatTZS } from "@/lib/currency";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  confirmed: "bg-green-500/15 text-green-600 border-green-500/30",
  rejected: "bg-red-500/15 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const InterCasinoTransfers = () => {
  const { roles, user } = useAuth();
  const { activeCasinoId, accessibleCasinos } = useCasino();
  const { data: transfers = [], isLoading } = useInterCasinoTransfers();
  const createTransfer = useCreateTransfer();
  const confirmTransfer = useConfirmTransfer();
  const rejectTransfer = useRejectTransfer();

  const isManagerOrAbove = roles.includes("manager") || roles.includes("finance_manager") || roles.includes("super_admin");

  const [showCreate, setShowCreate] = useState(false);
  const [toCasino, setToCasino] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const getCasinoName = (id: string) => accessibleCasinos.find(c => c.id === id)?.name ?? id.slice(0, 8);

  const handleCreate = () => {
    if (!activeCasinoId || !toCasino || !amount) return;
    createTransfer.mutate(
      { from_casino_id: activeCasinoId, to_casino_id: toCasino, amount: Number(amount), description },
      {
        onSuccess: () => {
          toast.success("Transfer created — pending confirmation");
          setShowCreate(false);
          setToCasino("");
          setAmount("");
          setDescription("");
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleConfirm = (id: string) => {
    confirmTransfer.mutate(id, {
      onSuccess: () => toast.success("Transfer confirmed"),
      onError: (e) => toast.error(e.message),
    });
  };

  const handleReject = () => {
    if (!rejectId) return;
    rejectTransfer.mutate(
      { transferId: rejectId, reason: rejectReason },
      {
        onSuccess: () => {
          toast.success("Transfer rejected");
          setRejectId(null);
          setRejectReason("");
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const otherCasinos = accessibleCasinos.filter(c => c.id !== activeCasinoId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Inter-Casino Transfers</h3>
          <p className="text-xs text-muted-foreground">Money movements between casinos</p>
        </div>
        {isManagerOrAbove && activeCasinoId && (
          <Button onClick={() => setShowCreate(true)} className="gap-1.5">
            <SendHorizonal className="w-4 h-4" /> Send Money
          </Button>
        )}
      </div>

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Date</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">From → To</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Amount</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Note</th>
              <th className="w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {transfers.map(t => {
              const canConfirm = t.status === "pending" && t.to_casino_id === activeCasinoId && isManagerOrAbove;
              return (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium text-card-foreground">{getCasinoName(t.from_casino_id)}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium text-card-foreground">{getCasinoName(t.to_casino_id)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-mono font-medium text-card-foreground">
                    {formatTZS(t.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[t.status] || ""}`}>
                      {t.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                    {t.rejected_reason || t.description || "—"}
                  </td>
                  <td className="px-2 py-3">
                    {canConfirm && (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => handleConfirm(t.id)}
                          className="p-1.5 rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                          title="Confirm receipt">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setRejectId(t.id); setRejectReason(""); }}
                          className="p-1.5 rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                          title="Reject">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {transfers.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No transfers yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Transfer Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send Money</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                From: {activeCasinoId ? getCasinoName(activeCasinoId) : "—"}
              </label>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">To Casino</label>
              <Select value={toCasino} onValueChange={setToCasino}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>
                  {otherCasinos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Amount (TZS)</label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 10000000" className="font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Float replenishment" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!toCasino || !amount || Number(amount) <= 0 || createTransfer.isPending}>
              {createTransfer.isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={() => setRejectId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Transfer</DialogTitle></DialogHeader>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Reason</label>
            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why is this rejected?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectTransfer.isPending}>
              {rejectTransfer.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InterCasinoTransfers;
