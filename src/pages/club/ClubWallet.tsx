import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clubApi } from "@/lib/club-api";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";
import { Sparkles, QrCode, ShieldCheck, ShieldAlert, ArrowRight, Ticket, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

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
  const qc = useQueryClient();
  const [showQr, setShowQr] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["club-wallet"],
    queryFn: () => clubApi.wallet(),
    refetchInterval: showQr ? 30_000 : 60_000,
  });

  const redeem = async () => {
    const clean = code.trim();
    if (!clean) return;
    setRedeeming(true);
    try {
      const res = await clubApi.redeemCode(clean);
      toast.success(`+${formatNumberSpaces(res.amount)} credits added`);
      setCode("");
      qc.invalidateQueries({ queryKey: ["club-wallet"] });
    } catch (e: any) {
      toast.error(e?.message || "Could not redeem code");
    } finally {
      setRedeeming(false);
    }
  };

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

  const category: string = ((player as any).category || "normal").toLowerCase();
  const TIERS: Record<string, { label: string; color: string; deep: string; glow: string; bg: string }> = {
    diamond:  { label: "Diamond",  color: "#B8F1FF", deep: "#5FB3CC", glow: "rgba(120,220,255,0.55)", bg: "linear-gradient(135deg,#0a1a22 0%,#0a2a36 60%,#0a1a22 100%)" },
    platinum: { label: "Platinum", color: "#E8ECF2", deep: "#9AA3B2", glow: "rgba(220,228,240,0.45)", bg: "linear-gradient(135deg,#15161a 0%,#2a2d36 60%,#15161a 100%)" },
    gold:     { label: "Gold",     color: "#F3D27A", deep: "#A6864A", glow: "rgba(243,210,122,0.55)", bg: "linear-gradient(135deg,#1a1206 0%,#3a2810 60%,#1a1206 100%)" },
    normal:   { label: "Member",   color: GOLD,      deep: GOLD_DEEP, glow: "rgba(232,198,136,0.25)", bg: "linear-gradient(135deg,#0a0a0a 0%,#171717 60%,#0a0a0a 100%)" },
  };
  const tier = TIERS[category] ?? TIERS.normal;
  const isElite = category !== "normal";

  return (
    <div className="space-y-6">
      {/* ===== Profile header ===== */}
      <div
        className="relative rounded-2xl border overflow-hidden"
        style={{
          background: tier.bg,
          borderColor: `${tier.color}55`,
          boxShadow: isElite
            ? `0 0 0 1px ${tier.color}22, 0 18px 40px -18px ${tier.glow}, inset 0 1px 0 ${tier.color}22`
            : `inset 0 1px 0 ${tier.color}18`,
        }}
      >
        {isElite && (
          <>
            <div
              className="pointer-events-none absolute -top-20 -left-20 w-56 h-56 rounded-full opacity-40"
              style={{ background: `radial-gradient(circle, ${tier.glow} 0%, transparent 70%)` }}
            />
            <div
              className="pointer-events-none absolute -bottom-24 -right-16 w-56 h-56 rounded-full opacity-30"
              style={{ background: `radial-gradient(circle, ${tier.glow} 0%, transparent 70%)` }}
            />
          </>
        )}
        <div className="relative p-5 flex items-center gap-4">
          <div
            className="relative w-16 h-16 rounded-full flex items-center justify-center font-faberge text-xl shrink-0 overflow-hidden"
            style={{
              backgroundColor: tier.color,
              color: "#0a0a0a",
              boxShadow: isElite
                ? `0 0 0 2px #0a0a0a, 0 0 0 4px ${tier.color}, 0 0 24px ${tier.glow}`
                : `0 0 0 2px ${tier.color}55`,
            }}
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
          <div className="flex-1 min-w-0">
            <p
              className="font-faberge text-lg leading-tight truncate"
              style={{
                color: tier.color,
                textShadow: isElite ? `0 0 12px ${tier.glow}` : "none",
              }}
            >
              {player.first_name} {player.last_name}
            </p>
            <p className="text-[10px] tracking-[0.25em] uppercase mt-0.5" style={{ color: tier.deep }}>
              {player.phone}
            </p>
            <span
              className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border font-faberge text-[10px] tracking-[0.3em] uppercase"
              style={{
                color: tier.color,
                borderColor: `${tier.color}66`,
                backgroundColor: "rgba(0,0,0,0.4)",
                boxShadow: isElite ? `0 0 14px ${tier.glow}, inset 0 0 8px ${tier.glow}` : "none",
              }}
            >
              {isElite && (
                <Sparkles
                  className="w-3 h-3"
                  style={{ color: tier.color, filter: `drop-shadow(0 0 4px ${tier.glow})` }}
                />
              )}
              {tier.label}
            </span>
          </div>
          <span
            title={isVerified ? "Verified" : (player.verification_status || "Unverified")}
            aria-label={isVerified ? "Verified" : (player.verification_status || "Unverified")}
            className="shrink-0 w-8 h-8 rounded-full border flex items-center justify-center"
            style={{
              color: isVerified ? tier.color : "#FFB4B4",
              borderColor: isVerified ? `${tier.color}66` : "#FFB4B466",
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            {isVerified ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          </span>
        </div>
      </div>


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

      {/* ===== Promo code redemption ===== */}
      <Panel className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Ticket className="w-3.5 h-3.5" style={{ color: GOLD }} />
          <p className="font-faberge text-[10px] tracking-[0.4em] uppercase" style={{ color: GOLD_DEEP }}>
            Promo code
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !redeeming) redeem();
            }}
            placeholder="ENTER CODE"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 h-11 rounded-md border px-3 font-mono tracking-[0.2em] uppercase outline-none min-w-0"
            style={{
              backgroundColor: "rgba(0,0,0,0.55)",
              borderColor: `${GOLD}55`,
              color: GOLD,
            }}
          />
          <button
            type="button"
            onClick={redeem}
            disabled={redeeming || !code.trim()}
            className="h-11 px-4 rounded-md font-faberge text-[11px] tracking-[0.3em] uppercase flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
          >
            {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Redeem"}
          </button>
        </div>
      </Panel>



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
