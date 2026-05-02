import { supabase } from "@/integrations/supabase/client";

const SNAPSHOT_PAGE_SIZE = 1000;
const SNAPSHOT_MAX_PAGES = 100;

export async function fetchChipSnapshots(casinoId: string, date: string) {
  const all: any[] = [];
  let from = 0;

  for (let i = 0; i < SNAPSHOT_MAX_PAGES; i++) {
    const { data, error } = await supabase
      .from("chip_snapshots")
      .select("*")
      .eq("casino_id", casinoId)
      .eq("date", date)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + SNAPSHOT_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < SNAPSHOT_PAGE_SIZE) break;
    from += SNAPSHOT_PAGE_SIZE;
  }

  return all;
}