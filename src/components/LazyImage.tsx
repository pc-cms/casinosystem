/**
 * Lazy-loaded image with placeholder initials and local caching.
 * Shows initials avatar until image loads, handles errors gracefully.
 */
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

type LazyImageProps = {
  src?: string | null;
  alt: string;
  initials?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export function LazyImage({ src, alt, initials, className, size = "md" }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [inView, setInView] = useState(false);

  const fallbackInitials = initials || alt?.slice(0, 2).toUpperCase() || "?";

  useEffect(() => {
    const el = imgRef.current;
    if (!el || !src) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observerRef.current.observe(el);

    return () => observerRef.current?.disconnect();
  }, [src]);

  if (!src || error) {
    return (
      <div
        className={cn(
          "rounded-full bg-muted flex items-center justify-center font-mono font-semibold text-muted-foreground shrink-0",
          sizeMap[size],
          className
        )}
      >
        {fallbackInitials}
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-full overflow-hidden shrink-0", sizeMap[size], className)} ref={imgRef}>
      {!loaded && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center font-mono text-muted-foreground text-xs">
          {fallbackInitials}
        </div>
      )}
      {inView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
}
