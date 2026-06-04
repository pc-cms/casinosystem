/**
 * ClubBackdrop — Premier brand signature pattern.
 * Dark-red canvas with overlapping rings + dot halo (matches Guideline pp. 21-23).
 * Pure SVG/CSS, no deps.
 */
export const ClubBackdrop = ({ className = "" }: { className?: string }) => {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {/* Base dark-red field with subtle vertical gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, #C8001A 0%, #A0000D 45%, #5A0008 100%)",
        }}
      />

      {/* Concentric rings — top right */}
      <svg
        className="absolute -top-40 -right-40 opacity-[0.18]"
        width="640"
        height="640"
        viewBox="0 0 640 640"
        fill="none"
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <circle
            key={i}
            cx="320"
            cy="320"
            r={60 + i * 30}
            stroke="#E8C688"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Concentric rings — bottom left */}
      <svg
        className="absolute -bottom-56 -left-40 opacity-[0.12]"
        width="720"
        height="720"
        viewBox="0 0 720 720"
        fill="none"
      >
        {Array.from({ length: 11 }).map((_, i) => (
          <circle
            key={i}
            cx="360"
            cy="360"
            r={40 + i * 32}
            stroke="#E8C688"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Dot halo overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.08]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#E8C688" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 100%, transparent 50%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
};

export default ClubBackdrop;
