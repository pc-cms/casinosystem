/**
 * Phase 2 flat-URL wrappers for the Pit (Live Game) shell.
 * Each export forces a specific tab so the URL is the source of truth
 * (no `?tab=` query param) and the access matrix can gate per ModuleKey.
 */
import Pit from "@/pages/Pit";

export const BreaklistPage = () => <Pit forcedTab="breaklist" />;
export const PitRotaPage = () => <Pit forcedTab="rota" />;
export const PitAttendancePage = () => <Pit forcedTab="attendance" />;
export const DealersPage = () => <Pit forcedTab="employee" />;
