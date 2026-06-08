import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PageShell — unified outer wrapper for every page in the system.
 * Use this around <PageHeader>, filters, and content to guarantee consistent
 * spacing, max-width and vertical rhythm.
 *
 * Usage:
 *   <PageShell>
 *     <PageHeader title="Reception" icon={Users}>... actions ...</PageHeader>
 *     <PageSection>... cards / forms ...</PageSection>
 *   </PageShell>
 *
 * The page route already lives inside <AppLayout>, which provides the outer
 * padding and max-w container, so PageShell only handles the inner stack
 * spacing. Do NOT add extra max-w / mx-auto / px-* on top of it.
 */
interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export const PageShell = ({ children, className }: PageShellProps) => (
  <div className={cn("space-y-4 overflow-x-clip", className)}>{children}</div>
);

/**
 * PageSection — a single content block. Wrap card-like content in this so
 * vertical rhythm stays consistent. Pass `card` to render a bordered surface
 * (most common); pass `flush` for full-bleed content like tables that already
 * provide their own border.
 */
interface PageSectionProps {
  children: ReactNode;
  /** Render with the standard card chrome (border + bg-card + p-4). Default: true. */
  card?: boolean;
  /** Section title rendered above content (text-sm uppercase muted). */
  title?: ReactNode;
  /** Right-side content next to the title (e.g. small actions, totals). */
  titleRight?: ReactNode;
  className?: string;
  /** Extra classes applied to the inner card body (only when card=true). */
  bodyClassName?: string;
}

export const PageSection = ({
  children,
  card = true,
  title,
  titleRight,
  className,
  bodyClassName,
}: PageSectionProps) => (
  <section className={cn("space-y-2", className)}>
    {(title || titleRight) && (
      <div className="flex items-center justify-between gap-3">
        {title && (
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h2>
        )}
        {titleRight && <div className="flex items-center gap-2">{titleRight}</div>}
      </div>
    )}
    {card ? (
      <div className={cn("rounded-md border border-border bg-card p-4", bodyClassName)}>
        {children}
      </div>
    ) : (
      children
    )}
  </section>
);
