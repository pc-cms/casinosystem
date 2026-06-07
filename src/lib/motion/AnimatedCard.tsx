import { motion } from "motion/react";
import { type ReactNode, type MouseEventHandler } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  hoverLift?: number;
  delay?: number;
}

export function AnimatedCard({
  children,
  className,
  onClick,
  hoverLift = 4,
  delay = 0,
}: AnimatedCardProps) {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return (
      <div className={className} onClick={onClick}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      onClick={onClick}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -hoverLift, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {children}
    </motion.div>
  );
}
