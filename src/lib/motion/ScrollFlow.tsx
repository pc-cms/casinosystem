import { useRef, type ReactNode, Children } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "./gsap";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface ScrollFlowProps {
  children: ReactNode;
  className?: string;
  pin?: boolean;
  scrub?: number | boolean;
}

export function ScrollFlow({
  children,
  className,
  pin = false,
  scrub = 0.5,
}: ScrollFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const steps = Children.toArray(children);

  useGSAP(
    () => {
      if (reduced || !containerRef.current) return;
      const stepEls = containerRef.current.querySelectorAll<HTMLElement>(
        "[data-scrollflow-step]",
      );
      if (!stepEls.length) return;

      gsap.set(stepEls, { opacity: 0, y: 32 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub,
          pin,
        },
      });

      stepEls.forEach((el, i) => {
        tl.to(el, { opacity: 1, y: 0, duration: 1, ease: "power2.out" }, i);
      });

      return () => {
        ScrollTrigger.getAll().forEach((t) => {
          if (t.trigger === containerRef.current) t.kill();
        });
      };
    },
    { scope: containerRef, dependencies: [reduced, pin, scrub] },
  );

  return (
    <div ref={containerRef} className={className}>
      {steps.map((child, i) => (
        <div key={i} data-scrollflow-step="">
          {child}
        </div>
      ))}
    </div>
  );
}
