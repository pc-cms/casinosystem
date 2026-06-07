/**
 * Light sky-and-clouds backdrop (Dreelio-inspired).
 * Pure CSS: vertical sky gradient (set on .landing-root) + a few drifting
 * soft cloud blobs. Sits behind all sections (z-index 0).
 */
export function BackdropLayers() {
  return (
    <div className="l-backdrop" aria-hidden>
      <div className="l-backdrop__sky" />
      <div className="l-backdrop__cloud l-backdrop__cloud--1" />
      <div className="l-backdrop__cloud l-backdrop__cloud--2" />
      <div className="l-backdrop__cloud l-backdrop__cloud--3" />
      <div className="l-backdrop__cloud l-backdrop__cloud--4" />
    </div>
  );
}
