import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { clubApi } from "@/lib/club-api";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck, ShieldAlert, ShieldQuestion, Phone, Calendar, IdCard, MapPin,
  Save, ArrowRight, X,
} from "lucide-react";
import { fmtDate } from "@/lib/format-date";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

const BRANCHES: { slug: string; label: string }[] = [
  { slug: "arusha", label: "Arusha" },
  { slug: "mwanza", label: "Mwanza" },
  { slug: "dodoma", label: "Dodoma" },
  { slug: "mbeya", label: "Mbeya" },
];

const inputStyle: React.CSSProperties = {
  backgroundColor: "rgba(0,0,0,0.55)",
  borderColor: `${GOLD}55`,
  color: GOLD,
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span
      className="block text-[10px] tracking-[0.3em] uppercase mb-1.5 font-faberge"
      style={{ color: GOLD_DEEP }}
    >
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

const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Icon className="w-4 h-4 shrink-0" style={{ color: GOLD_DEEP }} />
    <div className="flex-1 min-w-0">
      <p className="text-[9px] tracking-[0.3em] uppercase" style={{ color: GOLD_DEEP }}>{label}</p>
      <p className="text-sm truncate" style={{ color: GOLD }}>{value || "—"}</p>
    </div>
  </div>
);

export default function ClubProfile() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["club-wallet"],
    queryFn: () => clubApi.wallet(),
  });

  const player = data?.player;
  const status: string = player?.verification_status ?? "unverified";
  const isUnverified = status === "unverified";
  const isPending = status === "pending";
  const isVerified = status === "verified";

  // Local editable copy (only used while unverified)
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dob, setDob] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [casinoSlug, setCasinoSlug] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Initialise local state when wallet loads
  if (player && !dirty && first === "" && last === "") {
    setFirst(player.first_name ?? "");
    setLast(player.last_name ?? "");
    setDob(player.dob ?? "");
    setIdNumber(player.id_number ?? "");
    setCasinoSlug(player.casino_slug ?? "");
  }

  const save = useMutation({
    mutationFn: () => clubApi.updateProfile({
      first_name: first.trim(),
      last_name: last.trim(),
      dob,
      id_number: idNumber.trim() || null,
      casino_slug: casinoSlug || null,
    }),
    onSuccess: () => {
      toast.success("Profile saved");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["club-wallet"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelReview = useMutation({
    mutationFn: () => clubApi.cancelKyc(),
    onSuccess: () => {
      toast.success("Verification withdrawn");
      setConfirmCancel(false);
      qc.invalidateQueries({ queryKey: ["club-wallet"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateField = (setter: (s: string) => void) => (v: string) => {
    setter(v);
    setDirty(true);
  };

  if (isLoading) {
    return <p className="text-center font-faberge text-xs tracking-[0.3em] uppercase mt-10" style={{ color: GOLD_DEEP }}>Loading…</p>;
  }

  if (!player) {
    return (
      <div className="rounded-xl border bg-black/45 p-8 text-center mt-6" style={{ borderColor: `${GOLD}33` }}>
        <p className="font-faberge text-base" style={{ color: GOLD }}>No player record</p>
        <p className="text-xs mt-2" style={{ color: GOLD_DEEP }}>Sign out and register again to create your profile.</p>
      </div>
    );
  }

  const StatusBadge = () => (
    <span
      className="inline-flex items-center gap-1 text-[9px] tracking-[0.3em] uppercase px-2.5 py-1 rounded-full border"
      style={{
        color: isVerified ? GOLD : isPending ? "#FFE7A8" : "#FFB4B4",
        borderColor: isVerified ? `${GOLD}66` : isPending ? "#FFE7A866" : "#FFB4B466",
      }}
    >
      {isVerified ? <ShieldCheck className="w-3 h-3" /> :
       isPending ? <ShieldQuestion className="w-3 h-3" /> :
       <ShieldAlert className="w-3 h-3" />}
      {isVerified ? "Verified" : isPending ? "In review" : "Unverified"}
    </span>
  );

  const walkIn = isVerified && player.id
    ? `pclub:walkin:${player.id}`
    : null;

  return (
    <div className="space-y-6 pb-6">
      {/* ===== Header ===== */}
      <div className="text-center">
        <div
          className="w-20 h-20 rounded-full mx-auto flex items-center justify-center font-faberge text-2xl mb-3 overflow-hidden"
          style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
        >
          {player.photo_url ? (
            <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <>
              {(player.first_name?.[0] ?? "?").toUpperCase()}
              {(player.last_name?.[0] ?? "").toUpperCase()}
            </>
          )}
        </div>
        <h1 className="font-faberge text-2xl" style={{ color: GOLD }}>
          {player.first_name} {player.last_name}
        </h1>
        <div className="mt-2"><StatusBadge /></div>
        {isVerified && (player as any).verified_source === "reception" && (
          <p className="mt-1.5 text-[10px] tracking-[0.2em] uppercase" style={{ color: GOLD_DEEP }}>
            Verified at reception{(player as any).verified_at ? ` · ${new Date((player as any).verified_at).toLocaleDateString("en-GB")}` : ""}
          </p>
        )}
      </div>

      {/* ===== Walk-in QR (verified only) ===== */}
      {walkIn && (
        <div
          className="rounded-2xl border p-6 flex flex-col items-center gap-3"
          style={{ borderColor: `${GOLD}55`, backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <p className="font-faberge text-[10px] tracking-[0.4em] uppercase" style={{ color: GOLD_DEEP }}>Walk-in Pass</p>
          <div className="p-3 rounded-lg" style={{ backgroundColor: GOLD }}>
            <QRCodeSVG value={walkIn} size={180} bgColor={GOLD} fgColor="#0a0a0a" includeMargin={false} />
          </div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-center max-w-[220px]" style={{ color: GOLD_DEEP }}>
            Show at reception to check in
          </p>
        </div>
      )}

      {/* ===== Editable form / read-only details ===== */}
      <div
        className="rounded-xl border bg-black/45 p-5 space-y-4"
        style={{ borderColor: `${GOLD}33` }}
      >
        <p className="font-faberge text-[10px] tracking-[0.4em] uppercase" style={{ color: GOLD_DEEP }}>
          Personal details
        </p>

        {isUnverified ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <TextInput value={first} onChange={(e) => updateField(setFirst)(e.target.value)} />
              </Field>
              <Field label="Last name">
                <TextInput value={last} onChange={(e) => updateField(setLast)(e.target.value)} />
              </Field>
            </div>
            <Field label="Date of birth">
              <TextInput type="date" value={dob ?? ""} onChange={(e) => updateField(setDob)(e.target.value)} />
            </Field>
            <Field label="ID number (optional until verification)">
              <TextInput value={idNumber} onChange={(e) => updateField(setIdNumber)(e.target.value)} />
            </Field>
            <Field label="Home branch">
              <div className="grid grid-cols-2 gap-2">
                {BRANCHES.map((b) => {
                  const active = casinoSlug === b.slug;
                  return (
                    <button
                      key={b.slug}
                      type="button"
                      onClick={() => updateField(setCasinoSlug)(b.slug)}
                      className="h-11 rounded-md border text-xs tracking-[0.25em] uppercase font-faberge transition-colors"
                      style={{
                        backgroundColor: active ? GOLD : "rgba(0,0,0,0.5)",
                        color: active ? "#0a0a0a" : GOLD,
                        borderColor: active ? GOLD : `${GOLD}55`,
                      }}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !first.trim() || !last.trim() || !dob}
              className="w-full h-11 rounded-md border font-faberge text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ color: GOLD, borderColor: `${GOLD}66`, backgroundColor: "rgba(0,0,0,0.4)" }}
            >
              <Save className="w-4 h-4" /> {save.isPending ? "Saving…" : "Save changes"}
            </button>
          </>
        ) : (
          <div className="rounded-lg border divide-y" style={{ borderColor: `${GOLD}22` }}>
            <Row icon={Phone} label="Phone" value={player.phone} />
            <Row icon={Calendar} label="Date of birth" value={player.dob ? fmtDate(player.dob) : undefined} />
            <Row icon={IdCard} label="ID number" value={player.id_number} />
            <Row icon={MapPin} label="Home branch" value={player.casino_name} />
          </div>
        )}
      </div>

      {/* ===== Verification CTA / status ===== */}
      {isUnverified && (
        <button
          onClick={() => nav("/club/verify")}
          className="w-full h-14 rounded-xl font-faberge text-sm tracking-[0.3em] uppercase flex items-center justify-center gap-2"
          style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
        >
          Get verified <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {isPending && (
        <div
          className="rounded-xl border p-4 text-center space-y-3"
          style={{ borderColor: `${GOLD}55`, backgroundColor: "rgba(232,198,136,0.08)" }}
        >
          <p className="font-faberge text-sm tracking-[0.15em] uppercase" style={{ color: GOLD }}>
            Verification in review
          </p>
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: GOLD_DEEP }}>
            Our team will confirm your account shortly.
          </p>
          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              className="text-[10px] tracking-[0.3em] uppercase underline"
              style={{ color: GOLD_DEEP }}
            >
              Withdraw submission
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCancel(false)}
                className="flex-1 h-10 rounded-md border text-[10px] tracking-[0.3em] uppercase"
                style={{ color: GOLD_DEEP, borderColor: `${GOLD}33` }}
              >
                Keep
              </button>
              <button
                onClick={() => cancelReview.mutate()}
                disabled={cancelReview.isPending}
                className="flex-1 h-10 rounded-md text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-1.5"
                style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
              >
                <X className="w-3.5 h-3.5" /> {cancelReview.isPending ? "…" : "Withdraw"}
              </button>
            </div>
          )}
        </div>
      )}

      {isVerified && (
        <div
          className="rounded-xl border p-4 text-center"
          style={{ borderColor: `${GOLD}55`, backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: GOLD_DEEP }}>
            Account verified · enjoy full benefits.
          </p>
        </div>
      )}
    </div>
  );
}
