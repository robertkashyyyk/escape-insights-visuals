// The known equipment/amenity checks that can go on a property. Each becomes a
// check on the cleaner's job: photo-required (Hot Tub, BBQ…) or tick-only
// (Coffee Machine). Shared by the property editor and the Property Matrix so the
// same set of toggle-buttons drives everything — one source of truth
// (public.property_equipment).
export interface EquipmentPreset {
  name: string;
  requiresPhoto: boolean;
}

export const EQUIPMENT_PRESETS: EquipmentPreset[] = [
  { name: "Hot Tub", requiresPhoto: true },
  { name: "BBQ", requiresPhoto: true },
  { name: "Sauna", requiresPhoto: true },
  { name: "Pizza Oven", requiresPhoto: true },
  { name: "Coffee Machine", requiresPhoto: false },
];

export const presetByName = (name: string) =>
  EQUIPMENT_PRESETS.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());

export const isPreset = (name: string) => !!presetByName(name);
