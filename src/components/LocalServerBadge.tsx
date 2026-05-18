/**
 * LocalServerBadge — visible marker that this is an on-prem Local server,
 * not the Cloud instance. Shown only when runtime-config.json has
 * localMode === true (set by cms-frontend entrypoint at container start).
 *
 * Renders:
 *   - A 2px amber strip at the very top of the viewport
 *   - A small chip in the top-right corner: "LOCAL · <casino_slug>"
 *
 * On Cloud (casinosystem.app, lovable.app) this returns null.
 */
import { useEffect, useState } from "react";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { Server } from "lucide-react";

export const LocalServerBadge = () => {
  return null;

  const [info, setInfo] = useState<{ slug: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    getRuntimeConfig()
      .then((cfg) => {
        if (!alive) return;
        if (cfg.localMode) setInfo({ slug: cfg.casinoSlug });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!info) return null;

  return (
    <>
      {/* Top strip — sits above everything to make the LOCAL state unmistakable */}
      <div
        className="fixed top-0 left-0 right-0 h-[2px] bg-amber-500 z-[9999] pointer-events-none no-print"
        aria-hidden="true"
      />
      {/* Corner chip */}
      <div
        className="fixed top-1.5 right-2 z-[9999] no-print flex items-center gap-1
                   px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold
                   bg-amber-500/95 text-black shadow-sm select-none"
        title="On-premises local server"
      >
        <Server className="h-3 w-3" />
        <span>LOCAL{info.slug ? ` · ${info.slug.toUpperCase()}` : ""}</span>
      </div>
    </>
  );
};
