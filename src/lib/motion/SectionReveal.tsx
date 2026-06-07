import { motion, type HTMLMotionProps } from "motion/react";
import { type ElementType, type ReactNode } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface SectionRevealProps {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  y?: number;
  className?: string;
  amount?: number;
  once?: boolean;
}

export function SectionReveal({
  children,
  as = "div",
  delay = 0,
  y = 24,
  className,
  amount = 0.2,
  once = true,
}: SectionRevealProps) {
  const reduced = usePrefersReducedMotion();
  const Tag = as as ElementType;

  if (reduced) {
    return <Tag className={className}>{children}</Tag>;
  }

  const MotionTag = motion(Tag) as React.ComponentType<HTMLMotionProps<"div">>;

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}
