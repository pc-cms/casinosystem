import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPWA } from "./lib/pwa-register";
import { installChunkRecovery } from "./lib/chunk-recovery";
import { initAuthLeaderElection } from "./lib/auth-leader";

// Install BEFORE rendering so we catch chunk errors during initial route load.
installChunkRecovery();

// Elect a single tab/PWA per device to own the Supabase token refresh loop.
// Prevents refresh-token storms (HTTP 429) when one account is open in
// multiple tabs/windows on the same device.
initAuthLeaderElection();

createRoot(document.getElementById("root")!).render(<App />);

// Register PWA service worker (no-op in editor preview / iframe / dev)
setupPWA();
