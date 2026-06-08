import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseStorageRef } from "@/lib/storage-signed";

/**
 * Resolve a stored value (path or publicUrl) into a short-lived signed URL.
 * Caches per-bucket+path so multiple consumers share a single request.
 */
export function useSignedStorageUrl(
  value: string | null | undefined,
  options?: { bucket?: string; expiresIn?: number; enabled?: boolean },
) {
  const expiresIn = options?.expiresIn ?? 3600;
  const ref = parseStorageRef(value, options?.bucket);
  const enabled = (options?.enabled ?? true) && !!ref;
  const q = useQuery({
    queryKey: ["signed-url", ref?.bucket, ref?.path],
    enabled,
    staleTime: Math.max(60_000, (expiresIn - 120) * 1000),
    gcTime: Math.max(60_000, (expiresIn - 60) * 1000),
    queryFn: async () => {
      if (!ref) return null;
      const { data, error } = await supabase.storage
        .from(ref.bucket)
        .createSignedUrl(ref.path, expiresIn);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
  return q.data ?? null;
}
