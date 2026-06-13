import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings, LogOut, Building2 } from "lucide-react";
import { OwnerSettingsDialog } from "@/components/owner/OwnerSettingsDialog";

function initials(name?: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function OwnerProfileMenu() {
  const { user, profile, signOut } = useAuth();
  const { isPreviewMode, selectedOwnerId, selectedOwnerName } = useOwnerPreview();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Resolve the owner record: in preview mode it's the selected owner; otherwise the
  // logged-in owner (property_owners.user_id = auth user).
  const { data: owner } = useQuery({
    queryKey: ["owner_profile", isPreviewMode ? selectedOwnerId : user?.id],
    enabled: !!(isPreviewMode ? selectedOwnerId : user),
    queryFn: async () => {
      let q = supabase.from("property_owners").select("id, name, email, company");
      q = isPreviewMode && selectedOwnerId ? q.eq("id", selectedOwnerId) : q.eq("user_id", user!.id);
      const { data } = await q.maybeSingle();
      return data;
    },
  });

  const { data: propertyCount = 0 } = useQuery({
    queryKey: ["owner_property_count", owner?.id],
    enabled: !!owner?.id,
    queryFn: async () => {
      const { count } = await supabase.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", owner!.id);
      return count ?? 0;
    },
  });

  const name = (isPreviewMode ? selectedOwnerName : owner?.name) || profile?.display_name || "Owner";

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center hover:bg-primary/25 transition-colors" aria-label="Profile">
            {initials(name)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">{initials(name)}</div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{name}</p>
              {owner?.email && <p className="text-[11px] text-muted-foreground truncate">{owner.email}</p>}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" />
            {propertyCount} {propertyCount === 1 ? "property" : "properties"}
            {owner?.company ? ` · ${owner.company}` : ""}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="gap-2 cursor-pointer">
            <Settings className="h-4 w-4" /> Settings
          </DropdownMenuItem>
          {!isPreviewMode && (
            <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <OwnerSettingsDialog ownerId={owner?.id ?? null} open={settingsOpen} onOpenChange={setSettingsOpen} canChangePassword={!isPreviewMode} />
    </>
  );
}
