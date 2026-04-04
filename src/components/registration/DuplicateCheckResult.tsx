import { CheckCircle2, AlertTriangle, Ban, User, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type DuplicateStatus = "idle" | "checking" | "ok" | "warning" | "blocked";

export interface DuplicateMatch {
  id: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  photo_url?: string | null;
  match_type: "document" | "name" | "phone";
  similarity?: number;
}

interface DuplicateCheckResultProps {
  status: DuplicateStatus;
  matches: DuplicateMatch[];
  onOverride?: () => void;
  overrideGranted?: boolean;
}

const DuplicateCheckResult = ({
  status,
  matches,
  onOverride,
  overrideGranted,
}: DuplicateCheckResultProps) => {
  if (status === "idle") return null;

  if (status === "checking") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Checking for duplicates…</span>
      </div>
    );
  }

  if (status === "ok") {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-primary" />
        <span className="text-sm text-primary font-medium">No duplicates found</span>
      </div>
    );
  }

  if (status === "blocked") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Ban className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive font-medium">
            Duplicate player detected (same document)
          </span>
        </div>
        {matches.filter(m => m.match_type === "document").map(m => (
          <MatchCard key={m.id} match={m} />
        ))}
        {!overrideGranted && onOverride && (
          <Button variant="outline" size="sm" onClick={onOverride} className="gap-1 text-xs">
            <AlertTriangle className="w-3 h-3" /> Manager Override
          </Button>
        )}
        {overrideGranted && (
          <Badge variant="outline" className="text-xs border-primary/30 text-primary gap-1">
            <CheckCircle2 className="w-3 h-3" /> Override granted — registration allowed
          </Badge>
        )}
      </div>
    );
  }

  // warning
  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-500" />
        <span className="text-sm text-yellow-500 font-medium">
          Possible duplicate detected
        </span>
      </div>
      {matches.map(m => (
        <MatchCard key={m.id} match={m} />
      ))}
      <p className="text-xs text-muted-foreground">You may proceed, but verify this is a different person.</p>
    </div>
  );
};

const MatchCard = ({ match }: { match: DuplicateMatch }) => (
  <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
      {match.photo_url ? (
        <img src={match.photo_url} className="w-full h-full object-cover" alt="" />
      ) : (
        <User className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-foreground truncate">
        {match.first_name} {match.last_name}
        {match.nickname && <span className="text-muted-foreground ml-1">({match.nickname})</span>}
      </p>
      <Badge variant="outline" className="text-[9px] mt-0.5">
        {match.match_type === "document" ? "Same document #" : match.match_type === "name" ? "Similar name" : "Same phone"}
      </Badge>
    </div>
  </div>
);

export default DuplicateCheckResult;
