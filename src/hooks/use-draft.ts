import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useDraft — sessionStorage-backed draft state for multi-step / long forms.
 * Survives navigation away from a wizard route. Cleared via `clear()`.
 *
 * NOTE: Only stores JSON-serializable values. Don't store File/Blob.
 */
export function useDraft<T>(key: string, initial: T) {
  const storageKey = `cms-draft:${key}`;
  const initialRef = useRef(initial);

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // ignore
    }
    return initial;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignore quota errors
    }
  }, [storageKey, value]);

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setValue(initialRef.current);
  }, [storageKey]);

  return [value, setValue, clear] as const;
}
