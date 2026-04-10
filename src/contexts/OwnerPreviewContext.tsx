import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface OwnerOption {
  id: string;
  name: string;
}

interface OwnerPreviewContextType {
  isPreviewMode: boolean;
  selectedOwnerId: string | null;
  setSelectedOwnerId: (id: string) => void;
  allOwners: OwnerOption[];
  selectedOwnerName: string | null;
}

const OwnerPreviewContext = createContext<OwnerPreviewContextType>({
  isPreviewMode: false,
  selectedOwnerId: null,
  setSelectedOwnerId: () => {},
  allOwners: [],
  selectedOwnerName: null,
});

export function OwnerPreviewProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const isAdmin = role === "super" || role === "senior";
  const [allOwners, setAllOwners] = useState<OwnerOption[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("property_owners")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAllOwners(data);
          setSelectedOwnerId(data[0].id);
        }
      });
  }, [isAdmin]);

  const selectedOwnerName = allOwners.find((o) => o.id === selectedOwnerId)?.name ?? null;

  return (
    <OwnerPreviewContext.Provider
      value={{ isPreviewMode: isAdmin, selectedOwnerId, setSelectedOwnerId, allOwners, selectedOwnerName }}
    >
      {children}
    </OwnerPreviewContext.Provider>
  );
}

export const useOwnerPreview = () => useContext(OwnerPreviewContext);
