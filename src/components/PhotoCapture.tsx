/**
 * PhotoCapture — handles photo upload + camera capture on Android/iOS.
 * 
 * Fixes the Android "session restore" loop:
 * - Before opening camera, saves a pending flag + context to sessionStorage
 * - On mount, checks if we're restoring from a camera session
 * - Provides both "Take Photo" and "Upload from Gallery" buttons
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus, X, User } from "lucide-react";
import { toast } from "sonner";

const PENDING_KEY = "cms-photo-capture-pending";

interface PhotoCaptureProps {
  /** Current photo URL (preview or existing) */
  photoUrl: string | null;
  /** Called when a file is selected/captured */
  onPhotoSelect: (file: File) => void;
  /** Called to clear the photo */
  onPhotoClear?: () => void;
  /** Optional label */
  label?: string;
  /** Size of the preview */
  size?: "sm" | "md" | "lg";
  /** Unique ID for session restore tracking */
  captureId?: string;
  /** Show camera option */
  showCamera?: boolean;
  /** Show gallery option */
  showGallery?: boolean;
  disabled?: boolean;
}

const PhotoCapture = ({
  photoUrl,
  onPhotoSelect,
  onPhotoClear,
  label = "Photo",
  size = "md",
  captureId = "default",
  showCamera = true,
  showGallery = true,
  disabled = false,
}: PhotoCaptureProps) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-20 h-20 sm:w-24 sm:h-24",
    lg: "w-28 h-28 sm:w-32 sm:h-32",
  };

  // Check for session restore on mount
  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (pending) {
      try {
        const data = JSON.parse(pending);
        if (data.captureId === captureId) {
          setRestoring(true);
          // Clear the flag so we don't loop
          sessionStorage.removeItem(PENDING_KEY);
          toast.info("Camera session was interrupted. Please try again.", { duration: 4000 });
          setTimeout(() => setRestoring(false), 1000);
        }
      } catch {
        sessionStorage.removeItem(PENDING_KEY);
      }
    }
  }, [captureId]);

  const markPending = useCallback(() => {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({
      captureId,
      timestamp: Date.now(),
    }));
  }, [captureId]);

  const clearPending = useCallback(() => {
    sessionStorage.removeItem(PENDING_KEY);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    clearPending();
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate it's an image
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Max 20MB
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image too large (max 20MB)");
      return;
    }

    onPhotoSelect(file);

    // Reset input so same file can be selected again
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }, [onPhotoSelect, clearPending]);

  const openCamera = useCallback(() => {
    if (disabled) return;
    markPending();
    cameraRef.current?.click();
  }, [disabled, markPending]);

  const openGallery = useCallback(() => {
    if (disabled) return;
    // Gallery doesn't cause session restore on Android, but mark anyway
    markPending();
    galleryRef.current?.click();
  }, [disabled, markPending]);

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {/* Preview */}
      <div className={`${sizeClasses[size]} rounded-xl bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0 relative`}>
        {photoUrl ? (
          <>
            <img src={photoUrl} className="w-full h-full object-cover" alt={label} />
            {onPhotoClear && !disabled && (
              <button
                type="button"
                onClick={onPhotoClear}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </>
        ) : (
          <User className="w-8 h-8 text-muted-foreground" />
        )}
      </div>

      {/* Buttons */}
      <div className="flex-1 space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="flex gap-1.5">
          {showCamera && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-xs flex-1 h-9"
              onClick={openCamera}
              disabled={disabled || restoring}
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{photoUrl ? "Retake" : "Camera"}</span>
              <span className="sm:hidden">{photoUrl ? "📷" : "📷"}</span>
            </Button>
          )}
          {showGallery && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-xs flex-1 h-9"
              onClick={openGallery}
              disabled={disabled || restoring}
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gallery</span>
              <span className="sm:hidden">🖼️</span>
            </Button>
          )}
        </div>
        {restoring && (
          <p className="text-[10px] text-warning animate-pulse">Session restored — tap again</p>
        )}
      </div>

      {/* Hidden inputs — separate for camera vs gallery */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default PhotoCapture;
