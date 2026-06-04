import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { clubApi } from "@/lib/club-api";
import { supabase } from "@/integrations/supabase/client";
import ClubBackdrop from "@/components/club/ClubBackdrop";
import CameraCapture from "@/components/club/CameraCapture";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

const STEPS = ["Selfie", "ID front", "ID back", "Confirm", "Submit"] as const;
type StepIdx = 0 | 1 | 2 | 3 | 4;

const inputStyle: React.CSSProperties = {
  backgroundColor: "rgba(0,0,0,0.55)",
  borderColor: `${GOLD}55`,
  color: GOLD,
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-[10px] tracking-[0.3em] uppercase mb-1.5 font-faberge" style={{ color: GOLD_DEEP }}>
      {label}
    </span>
    {children}
  </label>
);

const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
  const isDate = props.type === "date";
  return (
    <input
      {...props}
      className={`w-full h-12 rounded-md border px-3 outline-none min-w-0 ${props.className ?? ""}`}
      style={{
        ...inputStyle,
        ...(isDate
          ? { fontSize: "14px", textAlign: "left", WebkitAppearance: "none", appearance: "none" as any }
          : {}),
        ...(props.style || {}),
      }}
    />
  );
};

function splitFullName(full: string): { first: string; last: string } {
  const parts = (full || "").trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export default function ClubVerifyWizard() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: wallet } = useQuery({ queryKey: ["club-wallet"], queryFn: () => clubApi.wallet() });
  const player = wallet?.player;

  const [step, setStep] = useState<StepIdx>(0);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [idFront, setIdFront] = useState<string | null>(null);
  const [idBack, setIdBack] = useState<string | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dob, setDob] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [askCancel, setAskCancel] = useState(false);

  // Seed name/dob from player on entry into step 3
  const seedFromPlayer = () => {
    if (player && !first && !last) {
      setFirst(player.first_name ?? "");
      setLast(player.last_name ?? "");
      setDob(player.dob ?? "");
      setIdNumber(player.id_number ?? "");
    }
  };

  // Try OCR on the ID front photo (best-effort, fail silently)
  const runOcr = async (b64DataUrl: string) => {
    setOcrBusy(true);
    try {
      const clean = b64DataUrl.replace(/^data:[^;]+;base64,/, "");
      const { data, error } = await supabase.functions.invoke("ocr-document", {
        body: { image_base64: clean },
      });
      if (error) throw error;
      setOcrResult(data);
      if (data?.full_name && !first && !last) {
        const { first: f, last: l } = splitFullName(data.full_name);
        setFirst(f);
        setLast(l);
      }
      if (data?.document_number && !idNumber) {
        setIdNumber(String(data.document_number));
      }
    } catch (e: any) {
      // OCR is optional; user can fill manually
      console.warn("OCR failed", e?.message);
    } finally {
      setOcrBusy(false);
    }
  };

  const submit = useMutation({
    mutationFn: () => clubApi.submitKyc({
      first_name: first.trim(),
      last_name: last.trim(),
      dob,
      id_number: idNumber.trim(),
      selfie_b64: selfie!,
      id_front_b64: idFront!,
      id_back_b64: idBack!,
      ocr: ocrResult ?? undefined,
    }),
    onSuccess: () => {
      toast.success("Submitted for verification");
      qc.invalidateQueries({ queryKey: ["club-wallet"] });
      nav("/club/profile", { replace: true });
    },
    onError: (e: any) => toast.error(e.message || "Submit failed"),
  });

  const canNext = (() => {
    if (step === 0) return !!selfie;
    if (step === 1) return !!idFront;
    if (step === 2) return !!idBack;
    if (step === 3) return !!first.trim() && !!last.trim() && !!dob && !!idNumber.trim();
    return true;
  })();

  const goNext = async () => {
    if (step === 2 && idFront && !ocrResult) {
      // Kick off OCR before entering confirm step (don't block)
      runOcr(idFront);
    }
    if (step === 3) {
      submit.mutate();
      return;
    }
    seedFromPlayer();
    setStep((s) => Math.min(3, s + 1) as StepIdx);
  };

  return (
    <div className="relative min-h-screen flex flex-col text-white" style={{ backgroundColor: "#A0000D" }}>
      <ClubBackdrop />

      <header className="relative px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: `${GOLD}33`, backgroundColor: "rgba(0,0,0,0.35)" }}>
        <button
          onClick={() => (step === 0 ? setAskCancel(true) : setStep((s) => Math.max(0, s - 1) as StepIdx))}
          className="inline-flex items-center gap-1 text-[10px] tracking-[0.3em] uppercase"
          style={{ color: GOLD }}
        >
          <ArrowLeft className="w-4 h-4" /> {step === 0 ? "Cancel" : "Back"}
        </button>
        <span className="font-faberge text-xs tracking-[0.3em]" style={{ color: GOLD }}>
          GET VERIFIED
        </span>
        <span className="w-16 text-right text-[10px] tracking-[0.3em] uppercase" style={{ color: GOLD_DEEP }}>
          {step + 1} / 4
        </span>
      </header>

      {/* Stepper bar */}
      <div className="relative px-5 pt-4 flex gap-1.5">
        {STEPS.slice(0, 4).map((_s, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: i <= step ? GOLD : `${GOLD}33` }}
          />
        ))}
      </div>

      <main className="relative flex-1 px-5 py-6 max-w-md w-full mx-auto space-y-5">
        {step === 0 && (
          <>
            <div className="text-center">
              <h2 className="font-faberge text-xl" style={{ color: GOLD }}>Take a selfie</h2>
              <p className="text-[10px] tracking-[0.25em] uppercase mt-2" style={{ color: GOLD_DEEP }}>
                Good lighting · face the camera · no hat
              </p>
            </div>
            <CameraCapture facing="user" label="selfie" value={selfie} onChange={setSelfie} gold={GOLD} goldDeep={GOLD_DEEP} />
          </>
        )}

        {step === 1 && (
          <>
            <div className="text-center">
              <h2 className="font-faberge text-xl" style={{ color: GOLD }}>ID — front side</h2>
              <p className="text-[10px] tracking-[0.25em] uppercase mt-2" style={{ color: GOLD_DEEP }}>
                National ID, passport or driver's license
              </p>
            </div>
            <CameraCapture facing="environment" label="ID front" value={idFront} onChange={setIdFront} gold={GOLD} goldDeep={GOLD_DEEP} allowGallery />
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-center">
              <h2 className="font-faberge text-xl" style={{ color: GOLD }}>ID — back side</h2>
              <p className="text-[10px] tracking-[0.25em] uppercase mt-2" style={{ color: GOLD_DEEP }}>
                Photo of the reverse side
              </p>
            </div>
            <CameraCapture facing="environment" label="ID back" value={idBack} onChange={setIdBack} gold={GOLD} goldDeep={GOLD_DEEP} allowGallery />
          </>
        )}

        {step === 3 && (
          <>
            <div className="text-center">
              <h2 className="font-faberge text-xl" style={{ color: GOLD }}>Confirm details</h2>
              <p className="text-[10px] tracking-[0.25em] uppercase mt-2" style={{ color: GOLD_DEEP }}>
                {ocrBusy ? "Reading your ID…" : "Edit anything that doesn't match"}
              </p>
            </div>

            {ocrBusy && (
              <div className="flex items-center justify-center gap-2 text-[10px] tracking-[0.25em] uppercase" style={{ color: GOLD_DEEP }}>
                <Loader2 className="w-4 h-4 animate-spin" /> OCR in progress
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {[selfie, idFront, idBack].map((src, i) => (
                <div key={i} className="rounded-md overflow-hidden border" style={{ borderColor: `${GOLD}33` }}>
                  {src && <img src={src} alt="" className="w-full h-20 object-cover" />}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <TextInput value={first} onChange={(e) => setFirst(e.target.value)} />
              </Field>
              <Field label="Last name">
                <TextInput value={last} onChange={(e) => setLast(e.target.value)} />
              </Field>
            </div>
            <Field label="Date of birth">
              <TextInput type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </Field>
            <Field label="ID number">
              <TextInput value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </Field>

            <p className="text-[9px] tracking-[0.2em] uppercase text-center pt-1" style={{ color: GOLD_DEEP }}>
              Once you tap Send to verify, your profile will be locked until our team reviews it.
            </p>
          </>
        )}

        <button
          onClick={goNext}
          disabled={!canNext || submit.isPending}
          className="w-full h-12 rounded-md font-faberge text-sm tracking-[0.3em] uppercase flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
        >
          {submit.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
          ) : step === 3 ? (
            <><Check className="w-4 h-4" /> Send to verify</>
          ) : (
            <>Next <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </main>

      {askCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/70">
          <div className="rounded-xl border bg-black/85 p-5 space-y-3 max-w-xs w-full" style={{ borderColor: `${GOLD}55` }}>
            <p className="font-faberge text-sm tracking-[0.2em] uppercase" style={{ color: GOLD }}>Discard photos?</p>
            <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: GOLD_DEEP }}>
              You'll need to retake them next time.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setAskCancel(false)}
                className="flex-1 h-10 rounded-md border text-[10px] tracking-[0.3em] uppercase"
                style={{ color: GOLD_DEEP, borderColor: `${GOLD}33` }}
              >
                Keep
              </button>
              <button
                onClick={() => nav("/club/profile", { replace: true })}
                className="flex-1 h-10 rounded-md text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-1.5"
                style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
              >
                <X className="w-3.5 h-3.5" /> Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
