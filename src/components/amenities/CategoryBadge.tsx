import { Badge } from "@/components/ui/badge";
import { AmenityCategory, getCategoryMeta, GROUP_CLASSES } from "@/lib/amenityCategories";
import { cn } from "@/lib/utils";

interface Props {
  category: AmenityCategory | string;
  showIcon?: boolean;
  className?: string;
}

export function CategoryBadge({ category, showIcon = true, className }: Props) {
  const meta = getCategoryMeta(category);
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px] font-medium px-2 py-0.5 border",
        GROUP_CLASSES[meta.group],
        className,
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {meta.label}
    </Badge>
  );
}
