import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Camera, Eye, X } from "lucide-react";
import { compressImage } from "@/lib/image-compress";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SignedImage } from "@/components/SignedImage";

interface EmployeePhotoCellProps {
  id: string;
  name: string;
  photoUrl: string | null;
  onUpdate: (id: string, photoUrl: string) => void;
  canManage: boolean;
}

const EmployeePhotoCell = ({ id, name, photoUrl, onUpdate, canManage }: EmployeePhotoCellProps) => {
  const { roles } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSeePhoto = roles.some(r => ["manager", "surveillance", "hr", "super_admin", "finance_manager"].includes(r));
  if (!canSeePhoto) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canManage) { toast.error("Manager or HR access required"); return; }

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const path = `${id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("employee-photos")
        .upload(path, compressed.thumbnail, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("employee-photos")
        .getPublicUrl(path);

      onUpdate(id, publicUrl);
      toast.success("Photo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const hasPhoto = !!photoUrl;

  return (
    <td className="px-2 py-1">
      {hasPhoto ? (
        <button
          type="button"
          onClick={() => setViewOpen(true)}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          title={`View photo — ${name}`}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => canManage ? inputRef.current?.click() : toast.error("Manager or HR access required")}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
          title="Photo required — click to upload"
        >
          {uploading ? (
            <div className="w-3.5 h-3.5 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {/* Photo viewer dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogTitle className="sr-only">{name} — Photo</DialogTitle>
          <div className="relative">
            <SignedImage src={photoUrl!} bucket="employee-photos" alt={name} className="w-full h-auto max-h-[70vh] object-contain bg-black" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <p className="text-white text-sm font-medium">{name}</p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => { setViewOpen(false); inputRef.current?.click(); }}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-md px-2 py-1 text-xs flex items-center gap-1"
              >
                <Camera className="w-3 h-3" /> Replace
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </td>
  );
};

export default EmployeePhotoCell;
