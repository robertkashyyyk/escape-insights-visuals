import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";

export function ReservationsTable() {
  const [search, setSearch] = useState("");

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, listings(name)")
        .order("check_in", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = reservations?.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.guest_name.toLowerCase().includes(q) ||
      (r.listings as any)?.name?.toLowerCase().includes(q) ||
      r.platform?.toLowerCase().includes(q)
    );
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "confirmed": return "default";
      case "cancelled": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search reservations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead className="text-center">Nights</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No reservations found</TableCell>
                </TableRow>
              )}
              {filtered?.map((r) => {
                const nights = differenceInDays(parseISO(r.check_out), parseISO(r.check_in));
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.guest_name}</TableCell>
                    <TableCell>{(r.listings as any)?.name || "—"}</TableCell>
                    <TableCell>{format(parseISO(r.check_in), "dd MMM yyyy")}</TableCell>
                    <TableCell>{format(parseISO(r.check_out), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-center">{nights}</TableCell>
                    <TableCell className="text-right">
                      {r.total_amount != null ? `£${Number(r.total_amount).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>{r.platform || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(r.status) as any} className="capitalize text-xs">
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
