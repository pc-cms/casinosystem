import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";

const LOGIN_DOMAIN = "@cms.local";

const Login = () => {
  const { signIn } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const email = login.includes("@") ? login : `${login.toLowerCase().trim()}${LOGIN_DOMAIN}`;
    const { error } = await signIn(email, password);
    if (error) setError("Invalid login or password");
    setLoading(false);
  };

  const isArusha = typeof window !== "undefined" && /^arusha\./i.test(window.location.hostname);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-8">
          {isArusha ? (
            <>
              <img
                src="/arusha-premier-logo.svg"
                alt="Premier Casino 20"
                className="mx-auto mb-3 h-28 w-auto"
              />
              <p
                className="font-faberge text-sm uppercase tracking-[0.25em]"
                style={{ color: "#E8C688" }}
              >
                Casino Management System
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="w-8 h-8 text-primary" />
                <span className="text-2xl font-bold text-foreground">CMS</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Casino Management System</p>
            </>
          )}
        </div>

        <div className="cms-panel p-6">
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Login</label>
              <Input
                type="text"
                placeholder="username"
                value={login}
                onChange={e => setLogin(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                className="font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Password</label>
              <Input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {error && <p className="mt-3 text-xs text-destructive text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default Login;
