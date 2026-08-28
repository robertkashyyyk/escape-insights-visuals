// Controlled list of property types — used by the Property edit form and the
// Property Matrix so the value is consistent and filterable (no "Cottage" vs
// "cottage" vs "Detached Cottage" fragmentation). Add to this list to extend it.
export const PROPERTY_TYPES = [
  "Apartment",
  "House",
  "Cottage",
  "Bungalow",
  "Townhouse",
  "Lodge",
  "Cabin",
  "Barn conversion",
  "Studio",
  "Manor",
  "Chalet",
  "Other",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
