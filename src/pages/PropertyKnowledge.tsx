import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Search, AlertTriangle, ChevronRight } from "lucide-react";
import { usePropertyKnowledgeList, usePropertyKnowledgeSearch } from "@/hooks/usePropertyKnowledge";
import { formatDistanceToNow } from "date-fns";

const LOCATION_FILTERS = ["All", "Castle Hume", "Kesh", "Enniskillen", "Devenish", "Other"];

export default function PropertyKnowledge() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const { data: properties = [], isLoading } = usePropertyKnowledgeList();
  const { data: searchHits = [], isFetching: searching } = usePropertyKnowledgeSearch(search);

  const filtered = useMemo(() => {
    let list = properties;
    if (filter !== "All") {
      if (filter === "Other") {
        const known = ["Castle Hume", "Kesh", "Enniskillen", "Devenish"];
        list = list.filter(
          (p) => !known.some((k) => p.location_group?.toLowerCase().includes(k.toLowerCase()))
        );
      } else {
        list = list.filter((p) =>
          p.location_group?.toLowerCase().includes(filter.toLowerCase())
        );
      }
    }
    return list;
  }, [properties, filter]);

  const incompleteCount = properties.filter((p) => p.completion_score < 30).length;
  const incompleteRatio = properties.length > 0 ? incompleteCount / properties.length : 0;
  const showBanner = incompleteRatio > 0.5;

  const isSearching = search.trim().length >= 2;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Property Knowledge</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {properties.length} properties · Internal use only
            </p>
          </div>
        </div>

        {showBanner && (
          <Card className="p-4 border-primary/30 bg-primary/5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              <strong>{incompleteCount} properties</strong> have incomplete knowledge profiles.
              Start filling them in to unlock Orin's full property intelligence.
            </p>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search any property, issue, or question..."
            className="pl-10 h-12 text-base"
          />
        </div>

        {/* Filter pills */}
        {!isSearching && (
          <div className="flex flex-wrap gap-2">
            {LOCATION_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Search results */}
        {isSearching && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {searching ? "Searching..." : `${searchHits.length} results for "${search}"`}
            </p>
            {searchHits.map((hit, i) => (
              <Link
                key={i}
                to={`/property-knowledge/${hit.listingId}`}
                className="block"
              >
                <Card className="p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="font-semibold text-sm">{hit.propertyName}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {hit.section}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {highlight(hit.snippet, search)}
                  </p>
                </Card>
              </Link>
            ))}
            {!searching && searchHits.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No matches found.
              </p>
            )}
          </div>
        )}

        {/* Property list */}
        {!isSearching && (
          <div className="space-y-2">
            {isLoading && (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
            )}
            {filtered.map((p) => (
              <Link key={p.id} to={`/property-knowledge/${p.id}`}>
                <Card
                  className={`p-4 hover:border-primary/50 transition-colors ${
                    p.completion_score < 30 ? "border-primary/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base truncate">{p.name}</h3>
                        {p.location_group && (
                          <Badge variant="outline" className="text-[10px]">
                            {p.location_group}
                          </Badge>
                        )}
                        {p.bedrooms && (
                          <span className="text-xs text-muted-foreground">
                            {p.bedrooms} bed
                          </span>
                        )}
                        {p.completion_score < 30 && (
                          <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">
                            Needs attention
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={p.completion_score} className="h-1.5 flex-1 max-w-xs" />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {p.completion_score}%
                        </span>
                        {p.updated_at && (
                          <span className="text-xs text-muted-foreground">
                            · Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  const idx = lower.indexOf(lowerQ);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground px-0.5 rounded">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
