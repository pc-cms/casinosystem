import { supabase } from "@/integrations/supabase/client";

type LogCategory = "transaction" | "edit" | "lock" | "expense" | "player" | "system" | "breaklist" | "pit";

export const logAction = async (
  casinoId: string,
  category: LogCategory,
  action: string,
  details: Record<string, any> = {}
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !casinoId) return;

  await supabase.from("activity_logs").insert({
    casino_id: casinoId,
    category,
    action,
    details,
    operator_id: user.id,
  });
};
