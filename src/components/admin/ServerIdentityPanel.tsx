/**
 * ServerIdentityPanel — bind this local on-prem server to a casino in Cloud.
 * Reads & writes CASINO_SLUG / CASINO_ID / CASINO_NAME / LOCAL_DOMAIN / LOCAL_IP
 * in the local .env via cms-sync, then hot-restarts cms-frontend so the new
 * runtime-config takes effect.
 *
 * Hidden in Cloud mode.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Server, AlertTriangle, Save } from "lucide-react";
import {
  isLocalServer,
  useServerIdentity,
  useSaveServerIdentity,
} from "@/hooks/use-server-identity";
import { supabase } from "@/integrations/supabase/client";

export const ServerIdentityPanel = () => {
  if (!isLocalServer()) return null;

  const { data, isLoading } = useServerIdentity();
  const save = useSaveServerIdentity();

  // Casinos visible in local DB (populated by peer sync after pairing).
  const { data: casinos } = useQuery({
    queryKey: ["server-identity-casinos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casinos")
        .select("id, slug, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [ip, setIp] = useState("");
  const [casinoId, setCasinoId] = useState("");

  useEffect(() => {
    if (!data) return;
    setSlug(data.casino_slug ?? "");
    setName(data.casino_name ?? "");
    setDomain(data.local_domain ?? "");
    setIp(data.local_ip ?? "");
    setCasinoId(data.casino_id ?? "");
  }, [data]);

  const pickCasino = (id: string) => {
    setCasinoId(id);
    const c = (casinos ?? []).find((x: any) => x.id === id);
    if (c) {
      setSlug(c.slug ?? "");
      if (!name || name === "Local Casino") setName(c.name ?? "");
      if (!domain || domain === "casino.local") setDomain(`${c.slug}.local`);
    }
  };

  const onSave = () =>
    save.mutate({
      casino_slug: slug.trim().toLowerCase(),
      casino_id: casinoId.trim() || undefined,
      casino_name: name.trim(),
      local_domain: domain.trim(),
      local_ip: ip.trim(),
    });

  const dirty =
    data &&
    (slug !== data.casino_slug ||
      name !== data.casino_name ||
      domain !== data.local_domain ||
      ip !== data.local_ip ||
      casinoId !== data.casino_id);

  const noCasinos = !casinos || casinos.length === 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Server className="w-4 h-4" /> Server Identity
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Which casino this local server serves. Saving restarts the app (~30 s).
          </p>
        </div>
        {data?.unconfigured && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> Not configured
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          {noCasinos ? (
            <div className="text-xs text-muted-foreground rounded border border-dashed border-border p-3">
              No casinos found in local database yet. Connect this server to Cloud
              first (Add Peer below), then come back to pick the casino.
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Casino</Label>
              <Select value={casinoId} onValueChange={pickCasino}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick casino…" />
                </SelectTrigger>
                <SelectContent>
                  {(casinos ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="arusha"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Display name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Arusha"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">LAN hostname</Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="arusha.local"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">LAN IP</Label>
              <Input
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.94"
              />
            </div>
          </div>

          {casinoId && (
            <p className="text-[11px] text-muted-foreground font-mono">
              casino_id: {casinoId}
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={!dirty || !slug || save.isPending}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {save.isPending ? "Saving…" : "Save & restart"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
