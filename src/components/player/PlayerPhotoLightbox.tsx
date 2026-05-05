import { User } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  src?: string | null;
  alt?: string;
}

export const PlayerPhotoLightbox = ({ open, onOpenChange, src, alt }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 bg-background border-border overflow-hidden">
        {src ? (
          <img
            src={src}
            alt={alt || "Player photo"}
            className="w-full h-auto max-h-[85vh] object-contain bg-muted"
          />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center bg-muted">
            <User className="h-32 w-32 text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlayerPhotoLightbox;
