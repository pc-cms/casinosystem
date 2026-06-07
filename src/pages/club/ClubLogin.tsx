import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { clubApi, setClubSession } from "@/lib/club-api";
import ClubBackdrop from "@/components/club/ClubBackdrop";
import ClubFooter from "@/components/club/ClubFooter";
import ClubCard from "@/components/club/ClubCard";
import PhoneInput, { buildE164 } from "@/components/club/PhoneInput";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

export default function ClubLogin() {
  const navigate = useNavigate();
  const [phoneLocal, setPhoneLocal] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    const phone = buildE164(phoneLocal);
    if (phoneLocal.length < 8 || !password) return;
    setBusy(true);
    try {
      const res = await clubApi.loginPassword(phone, password);
      setClubSession(res.token, res.phone);
      toast.success(`Welcome ${res.player?.first_name ?? ""}`.trim());
      navigate("/club/wallet", { replace: true });
    } catch (e: any) {
      const msg = e?.message === "invalid_credentials" ? "Invalid phone or password" : (e?.message || "Sign in failed");
      toast.error(msg);
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

      <main className="relative flex-1 flex items-center justify-center px-5 py-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src="/premier-club-logo.svg" alt="Premier Club" className="h-20 w-20 mx-auto mb-5" />
            <h1 className="font-faberge text-3xl" style={{ color: GOLD }}>
              Welcome back
            </h1>
            <p className="text-[10px] tracking-[0.4em] uppercase mt-2" style={{ color: GOLD_DEEP }}>
              Sign in to your account
            </p>
          </div>

          <ClubCard className="p-6 space-y-4">
            <label className="block">
              <span className="block text-[10px] tracking-[0.3em] uppercase mb-1.5 font-faberge" style={{ color: GOLD_DEEP }}>
                Phone number
              </span>
              <PhoneInput value={phoneLocal} onChange={setPhoneLocal} autoFocus onEnter={signIn} />
            </label>
            <label className="block">
              <span className="block text-[10px] tracking-[0.3em] uppercase mb-1.5 font-faberge" style={{ color: GOLD_DEEP }}>
                Password
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") signIn(); }}
                className="w-full h-12 rounded-md border px-3 outline-none"
                style={{ backgroundColor: "rgba(0,0,0,0.55)", borderColor: `${GOLD}55`, color: GOLD }}
              />
            </label>
            <button
              onClick={signIn}
              disabled={phoneLocal.length < 8 || !password || busy}
              className="w-full h-12 rounded-md font-faberge text-sm tracking-[0.3em] uppercase disabled:opacity-50"
              style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>
            <p
              className="text-center text-[10px] tracking-[0.4em] uppercase pt-1"
              style={{ color: GOLD_DEEP }}
            >
              18+ · Play Responsibly
            </p>
          </ClubCard>

          <p className="text-center text-xs mt-6" style={{ color: GOLD_DEEP }}>
            New here?{" "}
            <Link to="/club/register" className="underline" style={{ color: GOLD }}>
              Create an account
            </Link>
          </p>
        </div>
      </main>
      <ClubFooter />
    </div>
  );
}
