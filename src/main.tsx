import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPWA } from "./lib/pwa-register";
import { installChunkRecovery } from "./lib/chunk-recovery";
import { initAuthLeaderElection } from "./lib/auth-leader";
import { installAuthThrottle } from "./lib/auth-throttle";

// Install BEFORE rendering so we catch chunk errors during initial route load.
installChunkRecovery();

// Patch window.fetch to throttle /auth/v1/token requests. Must run BEFORE any
// Supabase client call. Protects shared-IP networks (5-10 casino devices behind
// one public IP) from triggering Supabase's per-IP rate limit on /token.
installAuthThrottle();

// Elect a single tab/PWA per device to own the Supabase token refresh loop.
// Prevents refresh-token storms (HTTP 429) when one account is open in
// multiple tabs/windows on the same device.
initAuthLeaderElection();

createRoot(document.getElementById("root")!).render(<App />);

// Register PWA service worker (no-op in editor preview / iframe / dev)
setupPWA();
