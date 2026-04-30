import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPWA } from "./lib/pwa-register";

createRoot(document.getElementById("root")!).render(<App />);

// Register PWA service worker (no-op in editor preview / iframe / dev)
setupPWA();
