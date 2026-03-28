import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSyncEngine } from "./lib/sync-engine";

// Initialize offline sync engine
initSyncEngine();

createRoot(document.getElementById("root")!).render(<App />);
