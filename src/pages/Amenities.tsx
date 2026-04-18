import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Plus, Search, Pencil, Trash2, Star } from "lucide-react";
import { useAmenitiesList, useDeleteAmenity, useUpsertAmenity, type Amenity } from "@/hooks/useAmenities";
import { CategoryBadge } from "@/components/amenities/CategoryBadge";
import { AmenityFormSheet } from "@/components/amenities/AmenityFormSheet";
import { ALL_CATEGORIES, AMENITY_CATEGORIES } from "@/lib/amenityCategories";

export default function Amenities() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [open, setOpen] = useState(false);
  const { data: amenities = [], isLoading } = useAmenitiesList({ category, search });
  const upsert = useUpsertAmenity();
  const del = useDeleteAmenity();

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: amenities.length };
    for (const a of amenities) m[a.category] = (m[a.category] ?? 0) + 1;
    return m;
  }, [amenities]);

  const handleEdit = (a: Amenity) => { setEditing(a); setOpen(true); };
  const handleAdd = () => { setEditing(null); setOpen(true); };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Local Amenities</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Master list of nearby points of interest. Link to properties from the Property Knowledge → Local Area tab.
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1.5" /> Add amenity
          </Button>
        </div>

        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search amenities by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">All categories ({counts.all ?? 0})</SelectItem>
                {ALL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {AMENITY_CATEGORIES[c].label} ({counts[c] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Postcode</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              )}
              {!isLoading && amenities.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No amenities yet — add your first one.</TableCell></TableRow>
              )}
              {amenities.map((a) => (
                <TableRow key={a.id} className="group">
                  <TableCell>
                    <div className="font-medium text-sm">{a.name}</div>
                    {a.address && <div className="text-xs text-muted-foreground truncate max-w-[280px]">{a.address}</div>}
                  </TableCell>
                  <TableCell><CategoryBadge category={a.category} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.postcode || "—"}</TableCell>
                  <TableCell className="text-right">
                    {a.rating != null ? (
                      <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{a.rating.toFixed(1)}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={a.is_active}
                      onCheckedChange={(checked) =>
                        upsert.mutate({ id: a.id, name: a.name, category: a.category, is_active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(a)} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => { if (confirm(`Delete "${a.name}"? This will remove all property links.`)) del.mutate(a.id); }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AmenityFormSheet open={open} onOpenChange={setOpen} initial={editing} />
    </AppLayout>
  );
}
