import { cn } from "@/lib/utils";

/**
 * ClubCard — black-glass card with soft-gold hairline border.
 * Sits on the brand-red ClubBackdrop.
 */
export const ClubCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "relative rounded-2xl backdrop-blur-md",
      "bg-black/55 border",
      "shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]",
      className,
    )}
    style={{ borderColor: "rgba(232,198,136,0.35)" }}
  >
    {children}
  </div>
);

export default ClubCard;
