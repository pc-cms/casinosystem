import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { clubApi, setClubSession } from "@/lib/club-api";
import ClubBackdrop from "@/components/club/ClubBackdrop";
import ClubCard from "@/components/club/ClubCard";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

const inputStyle: React.CSSProperties = {
  backgroundColor: "rgba(0,0,0,0.55)",
  borderColor: `${GOLD}55`,
  color: GOLD,
};

export default function ClubLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const sendOtp = async () => {
    setBusy(true);
    try {
      await clubApi.sendOtp(phone);
      toast.success("Code sent");
      setStep("code");
    } catch (e: any) {
      toast.error(e.message || "Failed to send code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const res = await clubApi.verifyOtp(phone, code);
      setClubSession(res.token, res.phone);
      toast.success(res.player_exists ? `Welcome ${res.player?.first_name ?? ""}` : "Signed in");
      navigate(res.player_exists ? "/club/wallet" : "/club/register", { replace: true });
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col text-white" style={{ backgroundColor: "#A0000D" }}>
      <ClubBackdrop />

      <header className="relative px-5 pt-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs tracking-[0.25em] uppercase"
          style={{ color: GOLD }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <span className="font-faberge text-xs tracking-[0.3em]" style={{ color: GOLD }}>
          PREMIER CLUB
        </span>
        <span className="w-12" />
      </header>

      <main className="relative flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img
              src="/premier-club-logo.svg"
              alt="Premier Club"
              className="h-20 w-20 mx-auto mb-5"
            />
            <h1 className="font-faberge text-3xl" style={{ color: GOLD }}>
              Welcome back
            </h1>
            <p
              className="text-[10px] tracking-[0.4em] uppercase mt-2"
              style={{ color: GOLD_DEEP }}
            >
              Sign in to your account
            </p>
          </div>

          <ClubCard className="p-6 space-y-4">
            {step === "phone" ? (
              <>
                <label className="block">
                  <span
                    className="block text-[10px] tracking-[0.3em] uppercase mb-1.5 font-faberge"
                    style={{ color: GOLD_DEEP }}
                  >
                    Phone number
                  </span>
                  <input
                    type="tel"
                    placeholder="+255 7XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoFocus
                    className="w-full h-12 rounded-md border px-3 outline-none"
                    style={inputStyle}
                  />
                </label>
                <button
                  onClick={sendOtp}
                  disabled={!phone || busy}
                  className="w-full h-12 rounded-md font-faberge text-sm tracking-[0.3em] uppercase disabled:opacity-50"
                  style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
                >
                  {busy ? "Sending…" : "Send Code"}
                </button>
              </>
            ) : (
              <>
                <label className="block">
                  <span
                    className="block text-[10px] tracking-[0.3em] uppercase mb-1.5 font-faberge"
                    style={{ color: GOLD_DEEP }}
                  >
                    6-digit code
                  </span>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                    className="w-full h-14 rounded-md border px-3 outline-none text-center text-2xl tracking-[0.5em] font-mono"
                    style={inputStyle}
                  />
                </label>
                <button
                  onClick={verify}
                  disabled={code.length !== 6 || busy}
                  className="w-full h-12 rounded-md font-faberge text-sm tracking-[0.3em] uppercase disabled:opacity-50"
                  style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
                >
                  {busy ? "Verifying…" : "Verify"}
                </button>
                <button
                  onClick={() => setStep("phone")}
                  className="w-full text-xs tracking-[0.25em] uppercase"
                  style={{ color: GOLD_DEEP }}
                >
                  Change phone
                </button>
              </>
            )}
          </ClubCard>

          <p className="text-center text-xs mt-6" style={{ color: GOLD_DEEP }}>
            New here?{" "}
            <Link to="/club/register" className="underline" style={{ color: GOLD }}>
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
