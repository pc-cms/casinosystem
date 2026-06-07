/**
 * Fixed cinematic backdrop for the landing.
 * Pure CSS: grid + two radial washes + subtle noise.
 * Sits behind all sections (z-index 0) — sections are z-index 1.
 */
export function BackdropLayers() {
  return (
    <div className="l-backdrop" aria-hidden>
      <div className="l-backdrop__glow-1" />
      <div className="l-backdrop__glow-2" />
      <div className="l-backdrop__grid" />
      <div className="l-backdrop__noise" />
    </div>
  );
}
