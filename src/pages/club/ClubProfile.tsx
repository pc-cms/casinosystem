import { useQuery } from "@tanstack/react-query";
import { clubApi, getClubToken } from "@/lib/club-api";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, ShieldAlert, Phone, Calendar, IdCard, MapPin } from "lucide-react";
import { fmtDate } from "@/lib/format-date";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Icon className="w-4 h-4 shrink-0" style={{ color: GOLD_DEEP }} />
    <div className="flex-1 min-w-0">
      <p className="text-[9px] tracking-[0.3em] uppercase" style={{ color: GOLD_DEEP }}>
        {label}
      </p>
      <p className="text-sm truncate" style={{ color: GOLD }}>
        {value || "—"}
      </p>
    </div>
  </div>
);

export default function ClubProfile() {
  const { data, isLoading } = useQuery({
    queryKey: ["club-wallet"],
    queryFn: () => clubApi.wallet(),
  });

  const player = data?.player;
  const walkInPayload = getClubToken() ? `pclub:walkin:${getClubToken()}` : "";

  if (isLoading) {
    return (
      <p
        className="text-center font-faberge text-xs tracking-[0.3em] uppercase mt-10"
        style={{ color: GOLD_DEEP }}
      >
        Loading…
      </p>
    );
  }

  if (!player) {
    return (
      <div
        className="rounded-xl border bg-black/45 p-8 text-center mt-6"
        style={{ borderColor: `${GOLD}33` }}
      >
        <p className="font-faberge text-base" style={{ color: GOLD }}>No player record</p>
        <p className="text-xs mt-2" style={{ color: GOLD_DEEP }}>
          Visit any Premier Casino branch to register.
        </p>
      </div>
    );
  }

  const isVerified = player.verification_status === "verified";

  return (
    <div className="space-y-6">
      {/* ===== Header ===== */}
      <div className="text-center">
        <div
          className="w-20 h-20 rounded-full mx-auto flex items-center justify-center font-faberge text-2xl mb-3"
          style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
        >
          {(player.first_name?.[0] ?? "?").toUpperCase()}
          {(player.last_name?.[0] ?? "").toUpperCase()}
        </div>
        <h1 className="font-faberge text-2xl" style={{ color: GOLD }}>
          {player.first_name} {player.last_name}
        </h1>
        <span
          className="inline-flex items-center gap-1 text-[9px] tracking-[0.3em] uppercase px-2.5 py-1 rounded-full border mt-2"
          style={{
            color: isVerified ? GOLD : "#FFB4B4",
            borderColor: isVerified ? `${GOLD}66` : "#FFB4B466",
          }}
        >
          {isVerified ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
          {isVerified ? "Verified" : player.verification_status || "Pending verification"}
        </span>
      </div>

      {/* ===== Walk-in QR ===== */}
      <div
        className="rounded-2xl border p-6 flex flex-col items-center gap-3"
        style={{ borderColor: `${GOLD}55`, backgroundColor: "rgba(0,0,0,0.55)" }}
      >
        <p className="font-faberge text-[10px] tracking-[0.4em] uppercase" style={{ color: GOLD_DEEP }}>
          Walk-in Pass
        </p>
        {walkInPayload && (
          <div className="p-3 rounded-lg" style={{ backgroundColor: GOLD }}>
            <QRCodeSVG value={walkInPayload} size={200} bgColor={GOLD} fgColor="#0a0a0a" includeMargin={false} />
          </div>
        )}
        <p className="text-[10px] tracking-[0.25em] uppercase text-center max-w-[220px]" style={{ color: GOLD_DEEP }}>
          Show at reception to check in
        </p>
      </div>

      {/* ===== Details ===== */}
      <div
        className="rounded-xl border divide-y bg-black/45"
        style={{ borderColor: `${GOLD}33` }}
      >
        <Row icon={Phone} label="Phone" value={player.phone} />
        <Row icon={Calendar} label="Date of birth" value={player.dob ? fmtDate(player.dob) : undefined} />
        <Row icon={IdCard} label="ID number" value={player.id_number} />
        <Row icon={MapPin} label="Home branch" value={player.casino_name || player.casino_id} />
      </div>

      {!isVerified && (
        <div
          className="rounded-xl border p-4 text-center"
          style={{ borderColor: `${GOLD}55`, backgroundColor: "rgba(232,198,136,0.08)" }}
        >
          <p className="font-faberge text-sm tracking-[0.15em] uppercase" style={{ color: GOLD }}>
            Verification pending
          </p>
          <p className="text-[10px] tracking-[0.2em] uppercase mt-1" style={{ color: GOLD_DEEP }}>
            Visit reception with your ID to verify your account
          </p>
        </div>
      )}
    </div>
  );
}
