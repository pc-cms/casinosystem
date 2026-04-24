import { useMemo, useRef, useState } from "react";
import { Loader2, Upload, Plus, Trash2, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";
import {
  useBankChecks, useImportBankChecks, useCreateBankCheck, useDeleteBankCheck,
  compressForOcr, uploadCheckPhoto, type BankCheckInput,
} from "@/hooks/use-bank-checks";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";

const todayMinus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

export default function BankChecks() {
  const { activeCasinoId } = useCasino();
  const [from, setFrom] = useState(todayMinus(30));
  const [to, setTo] = useState(todayMinus(0));
  const { data: checks = [], isLoading } = useBankChecks(from, to);
  const importMut = useImportBankChecks();
  const createMut = useCreateBankCheck();
  const deleteMut = useDeleteBankCheck();

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const total = useMemo(
    () => checks.reduce((sum, c) => sum + Number(c.amount || 0), 0),
    [checks]
  );

  const handleFile = async (file: File) => {
    if (!activeCasinoId) {
      toast.error("No casino selected");
      return;
    }
    setImporting(true);
    try {
      // 1. Upload original to storage
      let photoPath: string | null = null;
      try {
        photoPath = await uploadCheckPhoto(file, activeCasinoId);
      } catch (e) {
        console.warn("Photo upload failed, continuing without photo:", e);
      }

      // 2. Compress for OCR
      const { base64, mime } = await compressForOcr(file);

      // 3. Call edge function
      const { data, error } = await supabase.functions.invoke("bank-check-ocr", {
        body: { image_base64: base64, mime_type: mime },
      });
      if (error) throw error;
      const ocrChecks = (data?.checks || []) as Array<{
        date: string; time: string; receipt_no: string; approval_code: string;
        amount: number; currency: string; bank: string; merchant: string; card_masked: string;
      }>;
      if (ocrChecks.length === 0) {
        toast.error("No checks recognized on the photo");
        return;
      }

      // 4. Map to insert payload
      const records: BankCheckInput[] = ocrChecks
        .filter((c) => Number(c.amount) > 0 || c.approval_code || c.receipt_no)
        .map((c) => ({
          check_date: c.date || todayMinus(0),
          check_time: c.time || null,
          receipt_no: c.receipt_no || "",
          approval_code: c.approval_code || "",
          amount: Number(c.amount) || 0,
          currency: (c.currency || "TZS").toUpperCase() === "USD" ? "USD" : "TZS",
          bank: c.bank || "",
          merchant: c.merchant || "",
          card_masked: c.card_masked || "",
          photo_url: photoPath,
          note: "",
        }));

      await importMut.mutateAsync(records);
    } catch (e) {
      console.error("Bank check import error:", e);
      const msg = e instanceof Error ? e.message : "Import error";
      toast.error(msg);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openPhoto = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("bank-checks")
      .createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error("Failed to open photo");
      return;
    }
    setPhotoPreview(data.signedUrl);
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bank Checks</h1>
          <p className="text-sm text-muted-foreground">
            Confirm bank transactions from POS terminal receipts
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Recognizing..." : "Import photo"}
          </Button>
          <Button variant="outline" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add manually
          </Button>
        </div>
      </div>

      {/* Date filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="ml-auto text-sm">
          Total: <span className="font-mono font-semibold">{checks.length}</span>{" "}
          · Sum: <span className="font-mono font-semibold">{formatCurrency(total, "TZS")}</span>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Bank</th>
              <th className="px-3 py-2 font-semibold">Currency</th>
              <th className="px-3 py-2 font-semibold">Receipt №</th>
              <th className="px-3 py-2 font-semibold">Approval</th>
              <th className="px-3 py-2 font-semibold">Card</th>
              <th className="px-3 py-2 font-semibold text-right">Amount</th>
              <th className="px-3 py-2 font-semibold text-center">Photo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </td>
              </tr>
            ) : checks.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-muted-foreground">
                  No checks for this period. Upload a photo or add manually.
                </td>
              </tr>
            ) : (
              checks.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">{fmtDate(c.check_date)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.check_time || "—"}</td>
                  <td className="px-3 py-2">{c.bank || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.currency || "TZS"}</td>
                  <td className="px-3 py-2 font-mono">{c.receipt_no || "—"}</td>
                  <td className="px-3 py-2 font-mono">{c.approval_code || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.card_masked || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {formatCurrency(Number(c.amount), c.currency || "TZS")}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.photo_url ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openPhoto(c.photo_url!)}
                        title="Show photo"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Delete check?")) deleteMut.mutate(c.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ManualAddDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={(input) => {
          createMut.mutate(input, { onSuccess: () => setShowAdd(false) });
        }}
        saving={createMut.isPending}
      />

      <Dialog open={!!photoPreview} onOpenChange={(o) => !o && setPhotoPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Check photo</DialogTitle>
          </DialogHeader>
          {photoPreview && (
            <img src={photoPreview} alt="check" className="w-full rounded max-h-[70vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManualAddDialog({
  open, onClose, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (i: BankCheckInput) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<BankCheckInput>({
    check_date: todayMinus(0),
    check_time: null,
    receipt_no: "",
    approval_code: "",
    amount: 0,
    currency: "TZS",
    bank: "NBC",
    merchant: "",
    card_masked: "",
    photo_url: null,
    note: "",
  });

  const upd = <K extends keyof BankCheckInput>(k: K, v: BankCheckInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add check manually</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.check_date} onChange={(e) => upd("check_date", e.target.value)} />
          </div>
          <div>
            <Label>Time</Label>
            <Input
              type="time"
              value={form.check_time || ""}
              onChange={(e) => upd("check_time", e.target.value || null)}
            />
          </div>
          <div>
            <Label>Bank</Label>
            <Input value={form.bank} onChange={(e) => upd("bank", e.target.value)} />
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(value) => upd("currency", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TZS">TZS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Receipt №</Label>
            <Input value={form.receipt_no} onChange={(e) => upd("receipt_no", e.target.value)} />
          </div>
          <div>
            <Label>Approval Code</Label>
            <Input value={form.approval_code} onChange={(e) => upd("approval_code", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Card (masked)</Label>
            <Input value={form.card_masked} onChange={(e) => upd("card_masked", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Amount</Label>
            <Input
              type="number"
              value={form.amount || ""}
              onChange={(e) => upd("amount", Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || form.amount <= 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
