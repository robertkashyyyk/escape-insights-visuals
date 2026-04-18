import { Bed, Bath, Users, Waves, Zap, Dog, KeyRound } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PropertyFeaturesProps {
  bedrooms?: number | null;
  bathrooms?: number | null;
  maxGuests?: number | null;
  hasHotTub?: boolean;
  hasEvCharger?: boolean;
  petFriendly?: boolean;
  selfCheckIn?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Compact icon+number pairs and amenity-only badges, shared by Properties cards & Top Properties widget */
export function PropertyFeatures({
  bedrooms,
  bathrooms,
  maxGuests,
  hasHotTub,
  hasEvCharger,
  petFriendly,
  selfCheckIn,
  size = "sm",
  className = "",
}: PropertyFeaturesProps) {
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = size === "sm" ? "text-[11px]" : "text-xs";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2 py-1";

  const stat = (icon: React.ReactNode, label: string | number, key: string) => (
    <span
      key={key}
      className={`flex items-center gap-1 ${textSize} text-muted-foreground bg-secondary/40 ${padding} rounded-md`}
    >
      {icon} {label}
    </span>
  );

  const amenityIcon = (icon: React.ReactNode, label: string, key: string) => (
    <Tooltip key={key}>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center justify-center ${padding} rounded-md bg-primary/10 text-primary border border-primary/20`}
          aria-label={label}
        >
          {icon}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {bedrooms != null && bedrooms > 0 &&
          stat(<Bed className={iconSize} />, bedrooms, "bed")}
        {bathrooms != null && bathrooms > 0 &&
          stat(<Bath className={iconSize} />, bathrooms, "bath")}
        {maxGuests != null && maxGuests > 0 &&
          stat(<Users className={iconSize} />, maxGuests, "guests")}

        {hasHotTub && amenityIcon(<Waves className={iconSize} />, "Hot Tub", "hottub")}
        {hasEvCharger && amenityIcon(<Zap className={iconSize} />, "EV Charger", "ev")}
        {petFriendly && amenityIcon(<Dog className={iconSize} />, "Pet Friendly", "pet")}
        {selfCheckIn && amenityIcon(<KeyRound className={iconSize} />, "Self Check-In", "self")}
      </div>
    </TooltipProvider>
  );
}
