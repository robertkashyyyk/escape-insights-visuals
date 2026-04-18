import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ExternalLink, Star } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { usePropertyAmenities } from "@/hooks/useAmenities";
import { buildDirectionsUrl, formatDistance } from "@/lib/amenityCategories";

interface Props {
  listingId: string;
}

/**
 * Read-only Local Area panel for the owner portal.
 * Excludes operational staff_note — public-facing amenity info only.
 */
export function OwnerLocalAreaTab({ listingId }: Props) {
  const { data: rows = [], isLoading } = usePropertyAmenities(listingId);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading nearby amenities…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No local amenities linked to this property yet. Your management team will add nearby points of interest soon.
      </p>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Distance</TableHead>
            <TableHead className="text-right w-32">Directions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => {
            const url = r.directions_url || buildDirectionsUrl({
              latitude: r.latitude, longitude: r.longitude, name: r.name, postcode: r.postcode,
            });
            return (
              <TableRow key={r.id}>
                <TableCell>{r.is_featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{r.name}</div>
                  {r.postcode && <div className="text-xs text-muted-foreground">{r.postcode}</div>}
                </TableCell>
                <TableCell><CategoryBadge category={r.category} /></TableCell>
                <TableCell className="text-sm tabular-nums whitespace-nowrap">
                  {formatDistance(r.distance_km, r.drive_time_mins)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                    <a href={url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> Open
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
