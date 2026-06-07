import type { ReactNode } from "react";

export function MockupFrame({
  label,
  src,
  alt,
  children,
  height = 220,
}: {
  label?: string;
  src?: string;
  alt?: string;
  children?: ReactNode;
  height?: number;
}) {
  return (
    <div className="l-mockup" style={{ minHeight: height + 36 }}>
      <div className="l-mockup-bar">
        <span className="l-mockup-dot" />
        <span className="l-mockup-dot" />
        <span className="l-mockup-dot" />
        {label && <span className="l-mockup-label">{label}</span>}
      </div>
      <div className="l-mockup-body" style={{ minHeight: height }}>
        {src ? (
          <img src={src} alt={alt ?? label ?? ""} loading="lazy" />
        ) : (
          children ?? <span>{label}</span>
        )}
      </div>
    </div>
  );
}
