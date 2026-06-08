import { ImgHTMLAttributes } from "react";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

interface SignedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Stored photo reference (raw path or publicUrl) */
  src: string | null | undefined;
  /** Bucket fallback used when src is a raw path */
  bucket?: string;
  /** Fallback element while signed URL is loading or src is empty */
  placeholder?: React.ReactNode;
}

/**
 * <img> that lazily resolves a Supabase Storage reference into a signed URL.
 * Replaces direct <img src={publicUrl}/> for private buckets.
 */
export const SignedImage = ({ src, bucket, placeholder, alt, ...rest }: SignedImageProps) => {
  const signed = useSignedStorageUrl(src, { bucket });
  if (!signed) return <>{placeholder ?? null}</>;
  return <img src={signed} alt={alt ?? ""} {...rest} />;
};
