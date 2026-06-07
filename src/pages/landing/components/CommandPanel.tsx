import { DarkPanel } from "./DarkPanel";

/**
 * Abstract dark "control room" composite for the hero.
 * No real screenshots — pure CSS/SVG widgets, dark navy + gold + teal.
 */
export function CommandPanel() {
  return (
    <DarkPanel label="CMS · Operations Command" minHeight={460}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 14,
          height: "100%",
        }}
      >
        {/* Left: KPI stack + sparkline */}
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {[
              { k: "DROP", v: "182 540", t: "var(--l-gold)" },
              { k: "WIN", v: "+24 870", t: "var(--l-emerald)" },
              { k: "FLOOR", v: "37/42", t: "var(--l-teal)" },
            ].map((c) => (
              <div
                key={c.k}
                style={{
                  border: "1px solid var(--l-border)",
                  background: "var(--l-bg-2)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div
                  className="l-mono"
                  style={{ fontSize: 9.5, color: "var(--l-text-dim)", letterSpacing: "0.18em" }}
                >
                  {c.k}
                </div>
                <div
                  className="l-mono l-tnum"
                  style={{ fontSize: 16, color: c.t, marginTop: 4, fontWeight: 600 }}
                >
                  {c.v}
                </div>
              </div>
            ))}
          </div>

          {/* sparkline */}
          <div
            style={{
              position: "relative",
              border: "1px solid var(--l-border)",
              borderRadius: 8,
              background: "var(--l-bg-2)",
              padding: 12,
              overflow: "hidden",
            }}
          >
            <div
              className="l-mono"
              style={{
                fontSize: 9.5,
                color: "var(--l-text-dim)",
                letterSpacing: "0.18em",
                marginBottom: 6,
              }}
            >
              SHIFT P&L — LAST 12H
            </div>
            <svg viewBox="0 0 300 80" preserveAspectRatio="none" style={{ width: "100%", height: "calc(100% - 22px)" }}>
              <defs>
                <linearGradient id="cp-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3fb8a6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3fb8a6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,55 L25,48 L50,52 L75,40 L100,44 L125,32 L150,36 L175,28 L200,22 L225,30 L250,18 L275,24 L300,14"
                fill="none"
                stroke="#3fb8a6"
                strokeWidth="1.5"
              />
              <path
                d="M0,55 L25,48 L50,52 L75,40 L100,44 L125,32 L150,36 L175,28 L200,22 L225,30 L250,18 L275,24 L300,14 L300,80 L0,80 Z"
                fill="url(#cp-fill)"
              />
            </svg>
          </div>

          {/* mini table */}
          <div
            style={{
              border: "1px solid var(--l-border)",
              borderRadius: 8,
              background: "var(--l-bg-2)",
              padding: "10px 12px",
            }}
          >
            <div
              className="l-mono"
              style={{ fontSize: 9.5, color: "var(--l-text-dim)", letterSpacing: "0.18em", marginBottom: 8 }}
            >
              CAGE — ACTIVE SHIFT
            </div>
            {[
              { l: "Float", v: "850 000", c: "var(--l-text)" },
              { l: "Drop", v: "+182 540", c: "var(--l-emerald)" },
              { l: "Miss", v: "−4 200", c: "var(--l-red)" },
            ].map((r) => (
              <div
                key={r.l}
                className="l-mono l-tnum"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  padding: "3px 0",
                  color: "var(--l-text-muted)",
                }}
              >
                <span>{r.l}</span>
                <span style={{ color: r.c }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: status nodes */}
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 14 }}>
          <div
            style={{
              border: "1px solid var(--l-border)",
              borderRadius: 8,
              background: "var(--l-bg-2)",
              padding: 12,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 6,
              alignContent: "start",
            }}
          >
            <div
              className="l-mono"
              style={{
                gridColumn: "1 / -1",
                fontSize: 9.5,
                color: "var(--l-text-dim)",
                letterSpacing: "0.18em",
                marginBottom: 4,
              }}
            >
              PIT · TABLES
            </div>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "1.5",
                  borderRadius: 4,
                  border: "1px solid var(--l-border)",
                  background:
                    i % 5 === 0
                      ? "rgba(226,92,92,0.12)"
                      : i % 3 === 0
                      ? "rgba(63,184,166,0.14)"
                      : "rgba(255,255,255,0.025)",
                }}
              />
            ))}
          </div>
          <div
            style={{
              border: "1px solid var(--l-border)",
              borderRadius: 8,
              background: "var(--l-bg-2)",
              padding: 12,
            }}
          >
            <div
              className="l-mono"
              style={{ fontSize: 9.5, color: "var(--l-text-dim)", letterSpacing: "0.18em", marginBottom: 8 }}
            >
              SURVEILLANCE
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--l-text)" }}>
              <span className="l-live-dot" />
              <span className="l-mono">LIVE · 24 ch.</span>
            </div>
            <div
              className="l-mono"
              style={{
                marginTop: 10,
                fontSize: 10.5,
                color: "var(--l-text-muted)",
                lineHeight: 1.7,
              }}
            >
              <div>· incident-tag T-07</div>
              <div>· observation P-114</div>
              <div>· audit-log synced</div>
            </div>
          </div>
        </div>
      </div>
    </DarkPanel>
  );
}
