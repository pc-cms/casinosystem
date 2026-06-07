import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface ParallaxScreenshotProps {
  src?: string;
  alt?: string;
  offset?: number;
  className?: string;
  imgClassName?: string;
  children?: ReactNode;
}

export function ParallaxScreenshot({
  src,
  alt = "",
  offset = 40,
  className,
  imgClassName,
  children,
}: ParallaxScreenshotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);

  const content =
    children ??
    (src ? (
      <img src={src} alt={alt} loading="lazy" className={imgClassName} />
    ) : null);

  if (reduced) {
    return (
      <div ref={ref} className={className}>
        {content}
      </div>
    );
  }

  return (
    <div ref={ref} className={className} style={{ overflow: "hidden" }}>
      <motion.div style={{ y, willChange: "transform" }}>{content}</motion.div>
    </div>
  );
}
