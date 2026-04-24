import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export type BankCheck = {
  id: string;
  casino_id: string;
  check_date: string;
  check_time: string | null;
  receipt_no: string;
  approval_code: string;
  amount: number;
  currency: string;
  bank: string;
  merchant: string;
  card_masked: string;
  photo_url: string | null;
  note: string;
  created_by: string;
  created_at: string;
};

export type BankCheckInput = Omit<BankCheck, "id" | "casino_id" | "created_by" | "created_at">;

export const useBankChecks = (fromDate?: string, toDate?: string) => {
  const { activeCasinoId } = useCasino();
  return useQuery({
    queryKey: ["bank-checks", activeCasinoId, fromDate, toDate],
    enabled: !!activeCasinoId,
    queryFn: async () => {
      let q = supabase
        .from("bank_checks")
        .select("*")
        .eq("casino_id", activeCasinoId!)
        .order("check_date", { ascending: false })
        .order("check_time", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (fromDate) q = q.gte("check_date", fromDate);
      if (toDate) q = q.lte("check_date", toDate);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BankCheck[];
    },
  });
};

export const useCreateBankCheck = () => {
  const { activeCasinoId } = useCasino();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BankCheckInput) => {
      if (!activeCasinoId) throw new Error("No active casino");
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("bank_checks")
        .insert({ ...input, casino_id: activeCasinoId, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as BankCheck;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-checks"] });
      toast.success("Check added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateBankCheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<BankCheckInput> }) => {
      const { error } = await supabase.from("bank_checks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-checks"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteBankCheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_checks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-checks"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

/** Bulk import: skip duplicates by approval_code (silently). */
export const useImportBankChecks = () => {
  const { activeCasinoId } = useCasino();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checks: BankCheckInput[]) => {
      if (!activeCasinoId) throw new Error("No active casino");
      if (!user?.id) throw new Error("Not authenticated");
      if (checks.length === 0) return { inserted: 0, skipped: 0 };

      // Find existing approval codes to skip
      const codes = checks.map((c) => c.approval_code).filter(Boolean);
      let existing = new Set<string>();
      if (codes.length > 0) {
        const { data, error } = await supabase
          .from("bank_checks")
          .select("approval_code")
          .eq("casino_id", activeCasinoId)
          .in("approval_code", codes);
        if (error) throw error;
        existing = new Set((data || []).map((r) => r.approval_code));
      }

      const toInsert = checks.filter(
        (c) => !c.approval_code || !existing.has(c.approval_code)
      );
      if (toInsert.length === 0) {
        return { inserted: 0, skipped: checks.length };
      }

      const records = toInsert.map((c) => ({
        ...c,
        casino_id: activeCasinoId,
        created_by: user.id,
      }));
      const { error } = await supabase.from("bank_checks").insert(records);
      if (error) throw error;
      return { inserted: toInsert.length, skipped: checks.length - toInsert.length };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["bank-checks"] });
      const msg =
        res.skipped > 0
          ? `Imported: ${res.inserted}, duplicates skipped: ${res.skipped}`
          : `Imported: ${res.inserted}`;
      toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

/** Read file as base64 without any decoding (works for HEIC/JPEG/PNG). */
async function fileToBase64(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

/** Compress image to JPEG ≤ 1600px max side. Falls back to original bytes if browser can't decode (e.g. HEIC). */
export async function compressForOcr(file: File): Promise<{ base64: string; mime: string }> {
  const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  // Browsers (except Safari) cannot decode HEIC via <img>. Send raw bytes; Gemini can read it.
  if (isHeic) {
    return { base64: await fileToBase64(file), mime: file.type || "image/heic" };
  }
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Image decode failed"));
      i.src = url;
    });
    const MAX = 1600;
    let { width, height } = img;
    if (width > MAX || height > MAX) {
      if (width >= height) {
        height = Math.round((height * MAX) / width);
        width = MAX;
      } else {
        width = Math.round((width * MAX) / height);
        height = MAX;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", 0.85)
    );
    return { base64: await fileToBase64(blob), mime: "image/jpeg" };
  } catch (e) {
    // Fallback: send original bytes as-is
    console.warn("compressForOcr fallback to raw bytes:", e);
    return { base64: await fileToBase64(file), mime: file.type || "image/jpeg" };
  }
}

/** Upload original photo to bank-checks bucket; returns storage path. */
export async function uploadCheckPhoto(file: File, casinoId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${casinoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("bank-checks").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
