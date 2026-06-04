import { useQuery } from "@tanstack/react-query";
import { clubApi } from "@/lib/club-api";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";
import { Sparkles, QrCode, ShieldCheck, ShieldAlert, ArrowRight } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Link } from "react-router-dom";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

const Section = ({ title, children, icon }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <section>
    <h3
      className="font-faberge text-[10px] tracking-[0.4em] uppercase mb-3 flex items-center gap-2"
      style={{ color: GOLD_DEEP }}
    >
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-xl border backdrop-blur-sm bg-black/45 ${className}`}
    style={{ borderColor: `${GOLD}33` }}
  >
    {children}
  </div>
);

export default function ClubWallet() {
  const [showQr, setShowQr] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["club-wallet"],
    queryFn: () => clubApi.wallet(),
    refetchInterval: showQr ? 30_000 : 60_000,
  });

  const grants = data?.grants ?? [];
  const redemptions = data?.redemptions ?? [];
  const qrPayload = data?.redeem_token ?? "";

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
  if (error) {
    return <p className="text-sm text-center" style={{ color: GOLD }}>{(error as Error).message}</p>;
  }
  if (!data?.player) {
    return (
      <Panel className="p-8 text-center space-y-3 mt-6">
        <p className="font-faberge text-base" style={{ color: GOLD }}>No player record</p>
        <p className="text-xs" style={{ color: GOLD_DEEP }}>
          Visit any Premier Casino branch to register, then return here.
        </p>
      </Panel>
    );
  }

  const player = data.player;
  const isVerified = player.verification_status === "verified";

  return (
    <div className="space-y-6">
      {/* ===== Profile header ===== */}
      <Panel className="p-5 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center font-faberge text-xl shrink-0"
          style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
        >
          {(player.first_name?.[0] ?? "?").toUpperCase()}
          {(player.last_name?.[0] ?? "").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-faberge text-lg leading-tight truncate" style={{ color: GOLD }}>
            {player.first_name} {player.last_name}
          </p>
          <p className="text-[10px] tracking-[0.25em] uppercase mt-0.5" style={{ color: GOLD_DEEP }}>
            {player.phone}
          </p>
        </div>
        <span
          className="text-[9px] tracking-[0.25em] uppercase px-2 py-1 rounded-full border flex items-center gap-1"
          style={{
            color: isVerified ? GOLD : "#FFB4B4",
            borderColor: isVerified ? `${GOLD}66` : "#FFB4B466",
          }}
        >
          {isVerified ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
          {isVerified ? "Verified" : player.verification_status || "Pending"}
        </span>
      </Panel>

      {/* ===== Verification CTA ===== */}
      {!isVerified && (
        <Link
          to="/club/verify"
          className="flex items-center justify-between rounded-xl border px-4 py-3 backdrop-blur-sm"
          style={{ borderColor: `${GOLD}66`, backgroundColor: "rgba(232,198,136,0.08)" }}
        >
          <div>
            <p className="font-faberge text-sm tracking-[0.15em] uppercase" style={{ color: GOLD }}>
              Complete verification
            </p>
            <p className="text-[10px] tracking-[0.2em] uppercase mt-0.5" style={{ color: GOLD_DEEP }}>
              Unlock full member benefits
            </p>
          </div>
          <ArrowRight className="w-5 h-5" style={{ color: GOLD }} />
        </Link>
      )}

      {/* ===== Balance card ===== */}
      <div
        className="relative rounded-2xl p-6 overflow-hidden border"
        style={{
          background: "linear-gradient(135deg, #1a0004 0%, #3a0008 60%, #1a0004 100%)",
          borderColor: `${GOLD}55`,
          boxShadow: "0 20px 40px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(232,198,136,0.15)",
        }}
      >
        <div
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, ${GOLD} 0%, transparent 70%)` }}
        />
        <p className="font-faberge text-[10px] tracking-[0.4em] uppercase" style={{ color: GOLD_DEEP }}>
          Promo Balance
        </p>
        <p
          className="font-faberge text-5xl mt-2 tabular-nums"
          style={{ color: GOLD, letterSpacing: "0.02em" }}
        >
          {formatNumberSpaces(data.balance)}
        </p>
        <p className="text-[10px] tracking-[0.3em] uppercase mt-1" style={{ color: GOLD_DEEP }}>
          credits
        </p>
      </div>

      {/* ===== Redemption QR ===== */}
      <Panel className="p-5">
        {showQr && qrPayload ? (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: GOLD }}>
              <QRCodeSVG value={qrPayload} size={192} bgColor={GOLD} fgColor="#0a0a0a" includeMargin={false} />
            </div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-center" style={{ color: GOLD_DEEP }}>
              Show to cashier to redeem
            </p>
            <button
              onClick={() => setShowQr(false)}
              className="text-[10px] tracking-[0.3em] uppercase underline"
              style={{ color: GOLD }}
            >
              Hide
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowQr(true)}
            className="w-full h-12 rounded-md font-faberge text-sm tracking-[0.3em] uppercase flex items-center justify-center gap-2"
            style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
          >
            <QrCode className="w-5 h-5" /> Redemption QR
          </button>
        )}
      </Panel>

      {/* ===== Active grants ===== */}
      <Section title="Active grants">
        {grants.length === 0 ? (
          <Panel className="p-4">
            <p className="text-xs text-center" style={{ color: GOLD_DEEP }}>No active grants.</p>
          </Panel>
        ) : (
          <ul className="space-y-2">
            {grants.map((g: any) => (
              <li key={g.id}>
                <Panel className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: GOLD_DEEP }}>
                      {g.source}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(232,198,136,0.55)" }}>
                      Expires {g.expires_at ? fmtDateTime(g.expires_at) : "never"}
                    </p>
                  </div>
                  <p className="font-faberge text-xl tabular-nums" style={{ color: GOLD }}>
                    {formatNumberSpaces(g.remaining)}
                  </p>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ===== Recent redemptions ===== */}
      <Section title="Recent redemptions" icon={<Sparkles className="w-3 h-3" />}>
        {redemptions.length === 0 ? (
          <Panel className="p-4">
            <p className="text-xs text-center" style={{ color: GOLD_DEEP }}>None yet.</p>
          </Panel>
        ) : (
          <Panel className="divide-y" >
            <div className="divide-y" style={{ borderColor: `${GOLD}22` }}>
              {redemptions.map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-2.5 text-xs"
                  style={{ borderColor: `${GOLD}22` }}
                >
                  <span style={{ color: GOLD_DEEP }}>
                    {fmtDateTime(r.created_at)} · {r.payout_type}
                  </span>
                  <span className="font-mono tabular-nums" style={{ color: GOLD }}>
                    −{formatNumberSpaces(r.amount)}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </Section>
    </div>
  );
}
