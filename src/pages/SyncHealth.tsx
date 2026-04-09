import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, Building2, Users, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function SyncHealth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const { data: syncLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["sync-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 10000,
  });

  const { data: unownedListings } = useQuery({
    queryKey: ["unowned-listings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, name, city, hostaway_listing_id, location_group")
        .is("owner_id", null);
      return data || [];
    },
  });

  const { data: owners } = useQuery({
    queryKey: ["owners-list"],
    queryFn: async () => {
      const { data } = await supabase.from("property_owners").select("id, name");
      return data || [];
    },
  });

  const handleAssignOwner = async (listingId: string, ownerId: string) => {
    const { error } = await supabase.from("listings").update({ owner_id: ownerId }).eq("id", listingId);
    if (error) {
      toast({ title: "Failed to assign owner", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Owner assigned" });
      queryClient.invalidateQueries({ queryKey: ["unowned-listings"] });
      queryClient.invalidateQueries({ queryKey: ["sync-health-count"] });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    toast({ title: "Sync started", description: "Pulling data from Hostaway..." });
    try {
      const { data, error } = await supabase.functions.invoke("hostaway-sync", { method: "POST" });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Sync complete", description: `${data.listings} listings, ${data.reservations} reservations synced.` });
        queryClient.invalidateQueries({ queryKey: ["sync-logs"] });
        queryClient.invalidateQueries({ queryKey: ["unowned-listings"] });
        queryClient.invalidateQueries({ queryKey: ["sync-health-count"] });
      } else {
        throw new Error(data?.error || "Unknown error");
      }
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const latestSync = syncLogs?.[0];

  const statusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "completed_with_errors": return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case "error": return <XCircle className="h-4 w-4 text-red-400" />;
      case "running": return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      completed_with_errors: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      error: "bg-red-500/20 text-red-400 border-red-500/30",
      running: "bg-primary/20 text-primary border-primary/30",
    };
    return (
      <Badge className={variants[status] || "bg-muted text-muted-foreground"}>
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  const issueCount = (unownedListings?.length || 0) +
    (latestSync?.status === "error" || latestSync?.status === "completed_with_errors" ? 1 : 0);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Sync Health
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor Hostaway sync status, errors, and data integrity
            </p>
          </div>
          <div className="flex items-center gap-3">
            {issueCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {issueCount} issue{issueCount > 1 ? "s" : ""} 
              </Badge>
            )}
            <Button onClick={handleSync} disabled={syncing} size="sm" className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                {latestSync ? statusIcon(latestSync.status) : <Clock className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <p className="text-xs text-muted-foreground">Last Sync</p>
                  <p className="text-sm font-medium text-foreground">
                    {latestSync?.started_at ? format(new Date(latestSync.started_at), "dd MMM HH:mm") : "Never"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Listings Synced</p>
                  <p className="text-sm font-medium text-foreground">{latestSync?.listings_synced ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Reservations Synced</p>
                  <p className="text-sm font-medium text-foreground">{latestSync?.reservations_synced ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Unowned Listings</p>
                  <p className="text-sm font-medium text-foreground">{unownedListings?.length ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unowned listings */}
        {unownedListings && unownedListings.length > 0 && (
          <Card className="border-amber-500/30 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <Users className="h-4 w-4 text-amber-400" />
                Listings Without Owners ({unownedListings.length})
              </CardTitle>
              <CardDescription>Assign an owner to each listing so their reservations appear correctly</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Hostaway ID</TableHead>
                    <TableHead>Assign Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unownedListings.map((listing) => (
                    <TableRow key={listing.id}>
                      <TableCell className="font-medium">{listing.name}</TableCell>
                      <TableCell className="text-muted-foreground">{listing.location_group || listing.city || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{listing.hostaway_listing_id}</TableCell>
                      <TableCell>
                        <Select onValueChange={(val) => handleAssignOwner(listing.id, val)}>
                          <SelectTrigger className="w-48 h-8 text-xs bg-secondary/50 border-border/40">
                            <SelectValue placeholder="Select owner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {owners?.map((owner) => (
                              <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Sync history */}
        <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Sync History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !syncLogs || syncLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No syncs recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Listings</TableHead>
                    <TableHead>Reservations</TableHead>
                    <TableHead>Skipped</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncLogs.map((log: any) => {
                    const duration = log.completed_at && log.started_at
                      ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                      : null;
                    const errors = Array.isArray(log.errors) ? log.errors : [];
                    return (
                      <TableRow key={log.id}>
                        <TableCell>{statusBadge(log.status)}</TableCell>
                        <TableCell className="text-sm">{format(new Date(log.started_at), "dd MMM yyyy HH:mm")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {duration !== null ? `${duration}s` : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{log.listings_synced}</TableCell>
                        <TableCell className="text-sm">{log.reservations_synced}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.reservations_skipped}</TableCell>
                        <TableCell>
                          {errors.length > 0 ? (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1 h-6 px-2 text-red-400 hover:text-red-300">
                                  {errors.length} <ChevronDown className="h-3 w-3" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <div className="max-h-32 overflow-y-auto rounded border border-border/30 bg-secondary/30 p-2 space-y-1">
                                  {errors.slice(0, 10).map((err: string, i: number) => (
                                    <p key={i} className="text-xs text-red-400/80 font-mono break-all">{err}</p>
                                  ))}
                                  {errors.length > 10 && (
                                    <p className="text-xs text-muted-foreground">...and {errors.length - 10} more</p>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : (
                            <span className="text-sm text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
