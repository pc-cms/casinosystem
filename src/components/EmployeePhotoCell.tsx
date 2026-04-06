import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Camera, User } from "lucide-react";
import { compressImage } from "@/lib/image-compress";

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Only manager, surveillance, hr can see photos
  const canSeePhoto = roles.some(r => ["manager", "surveillance", "hr", "super_admin", "finance_manager"].includes(r));

  if (!canSeePhoto) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canManage) { toast.error("Manager or HR access required"); return; }

    setUploading(true);
    try {
      const compressed = await compressImage(file, 256);
      const ext = "jpg";
      const path = `${id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("employee-photos")
        .upload(path, compressed, { contentType: "image/jpeg", upsert: true });
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

  return (
    <td className="px-2 py-1">
      <div
        className={`relative w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center ${canManage ? "cursor-pointer group" : ""}`}
        onClick={() => canManage && inputRef.current?.click()}
        title={canManage ? "Click to upload photo" : name}
      >
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <User className="w-4 h-4 text-muted-foreground" />
        )}
        {canManage && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-3 h-3 text-white" />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </td>
  );
};

export default EmployeePhotoCell;
