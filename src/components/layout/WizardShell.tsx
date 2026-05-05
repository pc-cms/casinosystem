import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * WizardShell — full-page multi-step wizard primitive (M0 of modal redesign).
 *
 * Replaces big modals like CloseShiftDialog / CloseTableWizard / NewPlayerDialog.
 * One screen per step, no internal scroll, big action buttons in the footer.
 *
 * Wire up your steps as React nodes; pass `canNext` to gate the Next button.
 * Cancel triggers a confirm-dialog and (optionally) calls `onCancel` for cleanup
 * (e.g. clearing a useDraft).
 *
 * Usage:
 *   <WizardShell
 *     title="Close Shift"
 *     steps={[
 *       { id: "chips", label: "Chips",    content: <Step1 /> , canNext: chipsOk },
 *       { id: "cash",  label: "Cash",     content: <Step2 /> , canNext: cashOk },
 *       { id: "rev",   label: "Review",   content: <Review/>, canConfirm: true },
 *     ]}
 *     onConfirm={async () => { ... }}
 *     onCancel={() => draft.clear()}
 *     backTo="/cage"
 *   />
 */

export interface WizardStep {
  id: string;
  label: string;
  content: ReactNode;
  /** Allow advancing to the next step. Defaults to true. */
  canNext?: boolean;
  /** Final-step only: enable the Confirm button. Defaults to true on last step. */
  canConfirm?: boolean;
}

interface WizardShellProps {
  title: string;
  subtitle?: string;
  steps: WizardStep[];
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  /** Route to navigate to after Cancel/Confirm. */
  backTo: string;
  /** Custom Confirm label (defaults to "Confirm"). */
  confirmLabel?: string;
  /** Disable the confirm action while saving. */
  isSubmitting?: boolean;
  className?: string;
}

export const WizardShell = ({
  title,
  subtitle,
  steps,
  onConfirm,
  onCancel,
  backTo,
  confirmLabel = "Confirm",
  isSubmitting,
  className,
}: WizardShellProps) => {
  const nav = useNavigate();
  const [idx, setIdx] = useState(0);
  const [askCancel, setAskCancel] = useState(false);

  const isLast = idx === steps.length - 1;
  const step = steps[idx];
  const canNext = step.canNext !== false;
  const canConfirm = step.canConfirm !== false;

  const handleCancel = () => setAskCancel(true);
  const confirmCancel = () => {
    onCancel?.();
    setAskCancel(false);
    nav(backTo);
  };

  const handleConfirm = async () => {
    await onConfirm();
    onCancel?.(); // also clears any draft on success
    nav(backTo);
  };

  return (
    <PageShell className={className}>
      <PageHeader title={title} subtitle={subtitle}>
        <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-1">
          <X className="h-4 w-4" /> Cancel
        </Button>
      </PageHeader>

      {/* Step indicator */}
      <div className="flex items-center gap-2 px-1">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => i < idx && setIdx(i)}
              disabled={i > idx}
              className={cn(
                "flex items-center gap-2 text-xs font-medium transition-colors",
                i === idx && "text-primary",
                i < idx && "text-foreground hover:text-primary cursor-pointer",
                i > idx && "text-muted-foreground cursor-default"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                  i === idx && "border-primary bg-primary text-primary-foreground",
                  i < idx && "border-primary/40 bg-primary/10 text-primary",
                  i > idx && "border-border text-muted-foreground"
                )}
              >
                {i < idx ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="uppercase tracking-wider">{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1",
                  i < idx ? "bg-primary/40" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <PageSection card>{step.content}</PageSection>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <Button
          variant="outline"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0 || isSubmitting}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {isLast ? (
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isSubmitting}
            className="gap-1 min-w-32"
          >
            <Check className="h-4 w-4" />
            {isSubmitting ? "Saving…" : confirmLabel}
          </Button>
        ) : (
          <Button
            onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
            disabled={!canNext}
            className="gap-1 min-w-32"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <AlertDialog open={askCancel} onOpenChange={setAskCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress in this wizard will be lost. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};
