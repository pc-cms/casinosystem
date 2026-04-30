import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPWA } from "./lib/pwa-register";
import { installChunkRecovery } from "./lib/chunk-recovery";

// Install BEFORE rendering so we catch chunk errors during initial route load.
installChunkRecovery();

createRoot(document.getElementById("root")!).render(<App />);

// Register PWA service worker (no-op in editor preview / iframe / dev)
setupPWA();
