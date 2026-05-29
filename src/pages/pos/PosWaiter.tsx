import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { usePosCurrentShift } from "@/hooks/use-pos-shift";
import { usePosOpenTabs } from "@/hooks/use-pos-tabs";
import { fmtDateTime } from "@/lib/format-date";
import { formatNumberSpaces } from "@/lib/currency";
import OpenShiftCard from "@/components/pos/waiter/OpenShiftCard";
import TabsPanel from "@/components/pos/waiter/TabsPanel";
import MenuPanel from "@/components/pos/waiter/MenuPanel";
import ActiveTabPanel from "@/components/pos/waiter/ActiveTabPanel";
import NewTabDialog from "@/components/pos/waiter/NewTabDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

export default function PosWaiter() {
  const { user } = useAuth();
  const { activeCasinoId, activeCasino } = useCasino();
  const isMobile = useIsMobile();

  const { data: shift, isLoading: shiftLoading } = usePosCurrentShift(activeCasinoId, user?.id ?? null);
  const { data: tabs = [], isLoading: tabsLoading } = usePosOpenTabs(activeCasinoId, shift?.id ?? null);

  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [newTabOpen, setNewTabOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"tabs" | "menu" | "active">("tabs");

  if (!activeCasinoId) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Select a casino to start.
      </div>
    );
  }
  if (shiftLoading) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!shift) {
    return (
      <div className="p-4">
        <OpenShiftCard casinoId={activeCasinoId} userId={user!.id} />
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
    if (isMobile) setMobileView("menu");
  };

  const handleNewCreated = (id: string) => {
    setActiveTabId(id);
    if (isMobile) setMobileView("menu");
  };

  const ShiftBar = (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-card text-xs">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-semibold">{activeCasino?.name ?? ""}</span>
        <span className="text-muted-foreground truncate">
          Shift opened {fmtDateTime(shift.opened_at)}
        </span>
      </div>
      <div className="text-muted-foreground">
        Opening cash: <span className="font-mono tabular-nums">{formatNumberSpaces(shift.opening_cash)}</span>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        {ShiftBar}
        <Tabs value={mobileView} onValueChange={(v) => setMobileView(v as any)} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3 w-full rounded-none">
            <TabsTrigger value="tabs">Tabs ({tabs.length})</TabsTrigger>
            <TabsTrigger value="menu" disabled={!activeTabId}>Menu</TabsTrigger>
            <TabsTrigger value="active" disabled={!activeTabId}>Active</TabsTrigger>
          </TabsList>
          <TabsContent value="tabs" className="flex-1 m-0">
            <TabsPanel
              tabs={tabs}
              activeTabId={activeTabId}
              onSelect={handleSelectTab}
              onNew={() => setNewTabOpen(true)}
              loading={tabsLoading}
            />
          </TabsContent>
          <TabsContent value="menu" className="flex-1 m-0">
            <MenuPanel casinoId={activeCasinoId} shiftId={shift.id} tabId={activeTabId} userId={user!.id} />
          </TabsContent>
          <TabsContent value="active" className="flex-1 m-0">
            <ActiveTabPanel tab={activeTab} />
          </TabsContent>
        </Tabs>
        <NewTabDialog
          open={newTabOpen}
          onOpenChange={setNewTabOpen}
          casinoId={activeCasinoId}
          shiftId={shift.id}
          userId={user!.id}
          onCreated={handleNewCreated}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {ShiftBar}
      <div className="flex-1 grid grid-cols-12 min-h-0">
        <div className="col-span-3 border-r border-border min-h-0">
          <TabsPanel
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={handleSelectTab}
            onNew={() => setNewTabOpen(true)}
            loading={tabsLoading}
          />
        </div>
        <div className="col-span-5 border-r border-border min-h-0">
          <MenuPanel casinoId={activeCasinoId} shiftId={shift.id} tabId={activeTabId} userId={user!.id} />
        </div>
        <div className="col-span-4 min-h-0">
          <ActiveTabPanel tab={activeTab} />
        </div>
      </div>
      <NewTabDialog
        open={newTabOpen}
        onOpenChange={setNewTabOpen}
        casinoId={activeCasinoId}
        shiftId={shift.id}
        userId={user!.id}
        onCreated={handleNewCreated}
      />
    </div>
  );
}
