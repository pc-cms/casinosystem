import { motion, type Variants } from "motion/react";
import { type ReactNode } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  stagger?: number;
  delayChildren?: number;
  amount?: number;
  once?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

export function StaggerContainer({
  children,
  className,
  style,
  stagger = 0.08,
  delayChildren = 0,
  amount = 0.2,
  once = true,
}: StaggerContainerProps) {
  const reduced = usePrefersReducedMotion();

  if (reduced) return <div className={className} style={style}>{children}</div>;

  const variants: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };

  return (
    <motion.div
      className={className}
      style={style}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
    >
      {children}
    </motion.div>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
