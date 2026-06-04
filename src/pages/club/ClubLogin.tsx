import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clubApi, setClubSession } from "@/lib/club-api";
import { toast } from "sonner";

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
      toast.success("OTP sent");
      setStep("code");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const res = await clubApi.verifyOtp(phone, code);
      setClubSession(res.token, res.phone);
      toast.success(res.player_exists ? `Welcome ${res.player?.first_name ?? ""}` : "Logged in");
      navigate("/club/wallet", { replace: true });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 mt-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Sign in</h2>
        <p className="text-sm text-muted-foreground">Enter your phone to receive a one-time code.</p>
      </div>

      {step === "phone" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+255 7XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
          </div>
          <Button onClick={sendOtp} disabled={!phone || busy} className="w-full">
            {busy ? "Sending…" : "Send code"}
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
          </div>
          <Button onClick={verify} disabled={code.length !== 6 || busy} className="w-full">
            {busy ? "Verifying…" : "Verify"}
          </Button>
          <Button variant="ghost" onClick={() => setStep("phone")} className="w-full">
            Change phone
          </Button>
        </>
      )}
    </div>
  );
}
