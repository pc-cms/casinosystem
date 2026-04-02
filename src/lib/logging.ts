import { supabase } from "@/integrations/supabase/client";

type LogCategory = "transaction" | "edit" | "lock" | "expense" | "player" | "system" | "breaklist" | "pit";

// Cache the user id to avoid calling getUser() on every log action
let cachedUserId: string | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUserId = session?.user?.id ?? null;
});

export const logAction = async (
  casinoId: string,
  category: LogCategory,
  action: string,
  details: Record<string, any> = {}
) => {
  const operatorId = cachedUserId;
  if (!operatorId || !casinoId) return;

  await supabase.from("activity_logs").insert({
    casino_id: casinoId,
    category,
    action,
    details,
    operator_id: operatorId,
  });
};
