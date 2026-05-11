/**
 * PrintPortal — renders children directly under document.body.
 *
 * Required for printable shift reports because the parent Radix Dialog uses
 * `transform` to center its content, which creates a containing block that
 * breaks `position: absolute/fixed` and pushes printable content far down
 * the page (causing the first printed page to come up blank and the second
 * page to be clipped).
 *
 * Children are wrapped in a div with class `cms-print-root` so the global
 * `@media print` CSS can show only this subtree on paper.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const PrintPortal = ({ children }: { children: React.ReactNode }) => {
  const [el] = useState(() => {
    const d = document.createElement("div");
    d.className = "cms-print-root";
    return d;
  });

  useEffect(() => {
    document.body.appendChild(el);
    return () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [el]);

  return createPortal(children, el);
};

export default PrintPortal;
