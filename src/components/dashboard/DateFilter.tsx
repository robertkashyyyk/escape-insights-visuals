import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfYear, endOfYear, startOfQuarter, endOfQuarter, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PeriodType } from "@/hooks/useDashboardData";
import type { DateRange as DayPickerRange } from "react-day-picker";

const periods: PeriodType[] = ["Year", "Quarter", "Month", "Week", "Custom"];

const quarterOptions = ["Q1", "Q2", "Q3", "Q4"];
const monthOptions = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekOptions = Array.from({ length: 52 }, (_, i) => `W${i + 1}`);

interface DateFilterProps {
  dateRange: { from: Date; to: Date };
  periodType: PeriodType;
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  onPeriodTypeChange: (period: PeriodType) => void;
}

export function DateFilter({ dateRange, periodType, onDateRangeChange, onPeriodTypeChange }: DateFilterProps) {
  const [year, setYearState] = useState(dateRange.from.getFullYear());
  const [customRange, setCustomRange] = useState<DayPickerRange | undefined>({
    from: dateRange.from,
    to: dateRange.to,
  });

  const handlePeriodChange = (p: PeriodType) => {
    onPeriodTypeChange(p);
    if (p === "Custom") return;
    if (p === "Year") {
      onDateRangeChange({ from: startOfYear(new Date(year, 0)), to: endOfYear(new Date(year, 0)) });
    } else if (p === "Quarter") {
      const d = new Date(year, 0);
      onDateRangeChange({ from: startOfQuarter(d), to: endOfQuarter(d) });
    } else if (p === "Month") {
      const d = new Date(year, 0);
      onDateRangeChange({ from: startOfMonth(d), to: endOfMonth(d) });
    } else if (p === "Week") {
      const d = new Date(year, 0, 4);
      onDateRangeChange({ from: startOfWeek(d, { weekStartsOn: 1 }), to: endOfWeek(d, { weekStartsOn: 1 }) });
    }
  };

  const changeYear = (delta: number) => {
    const newYear = year + delta;
    setYearState(newYear);
    if (periodType === "Year") {
      onDateRangeChange({ from: startOfYear(new Date(newYear, 0)), to: endOfYear(new Date(newYear, 0)) });
    } else if (periodType !== "Custom") {
      const monthOfFrom = dateRange.from.getMonth();
      const d = new Date(newYear, monthOfFrom);
      if (periodType === "Quarter") {
        onDateRangeChange({ from: startOfQuarter(d), to: endOfQuarter(d) });
      } else if (periodType === "Month") {
        onDateRangeChange({ from: startOfMonth(d), to: endOfMonth(d) });
      } else if (periodType === "Week") {
        onDateRangeChange({ from: startOfWeek(d, { weekStartsOn: 1 }), to: endOfWeek(d, { weekStartsOn: 1 }) });
      }
    }
  };

  const handleSubPeriodChange = (val: string) => {
    if (periodType === "Quarter") {
      const qi = quarterOptions.indexOf(val);
      const d = new Date(year, qi * 3);
      onDateRangeChange({ from: startOfQuarter(d), to: endOfQuarter(d) });
    } else if (periodType === "Month") {
      const mi = monthOptions.indexOf(val);
      const d = new Date(year, mi);
      onDateRangeChange({ from: startOfMonth(d), to: endOfMonth(d) });
    } else if (periodType === "Week") {
      const wi = parseInt(val.replace("W", "")) - 1;
      const janFour = new Date(year, 0, 4);
      const weekStart = startOfWeek(janFour, { weekStartsOn: 1 });
      const target = new Date(weekStart);
      target.setDate(target.getDate() + wi * 7);
      onDateRangeChange({ from: startOfWeek(target, { weekStartsOn: 1 }), to: endOfWeek(target, { weekStartsOn: 1 }) });
    }
  };

  const getCurrentSubValue = (): string => {
    const m = dateRange.from.getMonth();
    if (periodType === "Quarter") return quarterOptions[Math.floor(m / 3)];
    if (periodType === "Month") return monthOptions[m];
    if (periodType === "Week") {
      const start = startOfYear(dateRange.from);
      const diff = Math.floor((dateRange.from.getTime() - start.getTime()) / (7 * 86400000)) + 1;
      return `W${Math.min(diff, 52)}`;
    }
    return "";
  };

  const subOptions = periodType === "Quarter" ? quarterOptions : periodType === "Month" ? monthOptions : periodType === "Week" ? weekOptions : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/40">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
              periodType === p
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {periodType !== "Custom" && (
        <div className="flex items-center gap-1">
          <button onClick={() => changeYear(-1)} className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-foreground min-w-[3rem] text-center">{year}</span>
          <button onClick={() => changeYear(1)} className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {subOptions.length > 0 && (
        <Select value={getCurrentSubValue()} onValueChange={handleSubPeriodChange}>
          <SelectTrigger className="w-[90px] h-8 text-xs bg-secondary/40 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {subOptions.map((o) => (
              <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {periodType === "Custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs bg-secondary/40 border-border/50">
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              {format(dateRange.from, "MMM d, yyyy")} – {format(dateRange.to, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={customRange}
              onSelect={(range) => {
                setCustomRange(range);
                if (range?.from && range?.to) {
                  onDateRangeChange({ from: range.from, to: range.to });
                }
              }}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}

      {periodType !== "Custom" && periodType !== "Year" && (
        <span className="text-xs text-muted-foreground">
          {format(dateRange.from, "MMM d")} – {format(dateRange.to, "MMM d, yyyy")}
        </span>
      )}
    </div>
  );
}
