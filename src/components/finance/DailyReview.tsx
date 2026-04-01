import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useDailySummaries, useUpsertDailySummary, useTablesResultForDate, useCageExpensesForDate } from "@/hooks/use-finance";
import { formatNumberSpaces, formatInputWithSpaces, parseSpacedNumber } from "@/lib/currency";
import { Check, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format, subDays, addDays } from "date-fns";

export const DailyReview = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [slotsInput, setSlotsInput] = useState("");
  const [comment, setComment] = useState("");

  const { data: summaries = [] } = useDailySummaries();
  const { data: tablesResult = 0 } = useTablesResultForDate(selectedDate);
  const { data: cageExpenses = 0 } = useCageExpensesForDate(selectedDate);
  const upsert = useUpsertDailySummary();

  const existing = summaries.find(s => s.date === selectedDate);
  const slotsValue = existing ? existing.slots_result : parseSpacedNumber(slotsInput);
  const totalResult = tablesResult + slotsValue;

  // Reset inputs when date changes
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setSlotsInput("");
    setComment("");
  };

  const handleConfirm = () => {
    upsert.mutate({
      date: selectedDate,
      tables_result: tablesResult,
      slots_result: slotsValue,
      total_expenses: cageExpenses,
      confirmed: true,
      comment: comment || existing?.comment || "",
    });
  };

  const handleSave = () => {
    upsert.mutate({
      date: selectedDate,
      tables_result: tablesResult,
      slots_result: slotsValue,
      total_expenses: cageExpenses,
      confirmed: false,
      comment: comment || existing?.comment || "",
    });
  };

  const prevDay = () => handleDateChange(format(subDays(new Date(selectedDate), 1), "yyyy-MM-dd"));
  const nextDay = () => handleDateChange(format(addDays(new Date(selectedDate), 1), "yyyy-MM-dd"));

  return (
    <div className="space-y-4 mt-4">
      {/* Date navigator */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={prevDay}><ChevronLeft className="w-4 h-4" /></Button>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/50">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={e => handleDateChange(e.target.value)}
            className="border-0 bg-transparent p-0 h-auto text-sm font-mono w-32"
          />
        </div>
        <Button variant="outline" size="icon" onClick={nextDay}><ChevronRight className="w-4 h-4" /></Button>
        {existing?.confirmed && <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Confirmed</Badge>}
      </div>

      {/* Results card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Day Results — {format(new Date(selectedDate), "dd MMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Tables Result (auto)</p>
              <p className="text-lg font-bold font-mono">{formatNumberSpaces(tablesResult)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Slots Result (manual)</p>
              {existing?.confirmed ? (
                <p className="text-lg font-bold font-mono">{formatNumberSpaces(existing.slots_result)}</p>
              ) : (
                <Input
                  className="font-mono text-lg font-bold h-8"
                  placeholder="0"
                  value={slotsInput}
                  onChange={e => setSlotsInput(formatInputWithSpaces(e.target.value))}
                />
              )}
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Total Result</p>
              <p className="text-lg font-bold font-mono text-primary">{formatNumberSpaces(totalResult)}</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Expenses (from Cage)</p>
            <p className="text-lg font-bold font-mono">{formatNumberSpaces(cageExpenses)}</p>
          </div>

          {/* Comment */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Comment</p>
            <Textarea
              value={comment || existing?.comment || ""}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a note for this day..."
              rows={2}
              disabled={existing?.confirmed}
            />
          </div>

          {/* Actions */}
          {!existing?.confirmed && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={upsert.isPending}>Save Draft</Button>
              <Button onClick={handleConfirm} disabled={upsert.isPending} className="gap-1">
                <Check className="w-4 h-4" /> Confirm Day
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recent Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {summaries.slice(0, 14).map(s => (
              <button
                key={s.id}
                onClick={() => handleDateChange(s.date)}
                className={`w-full flex items-center justify-between py-2 px-3 rounded-md text-sm transition-colors ${
                  s.date === selectedDate ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono">{s.date}</span>
                  {s.confirmed && <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-500/10 text-green-500 border-green-500/30">✓</Badge>}
                </div>
                <span className="font-mono font-medium">{formatNumberSpaces(s.total_result)}</span>
              </button>
            ))}
            {summaries.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No summaries yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
