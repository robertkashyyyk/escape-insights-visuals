// Canonical bundle fan-out rule (kept in sync with the edge scheduler
// generate-daily-cleaning-schedule). A booking on a bundle listing must produce
// exactly one clean per COMPONENT that doesn't already have a live clean for that
// booking — never a clean on the bundle listing itself, and completing/having one
// component's clean must not suppress the others.
export interface BundleFanoutInput {
  bundleListingId: string;
  componentListingIds: string[];
  /** Component listing ids that already have a LIVE (non-cancelled) clean for this booking. */
  componentsWithLiveClean: Set<string>;
}

/** Returns the component listing ids that should get a NEW clean for this booking. */
export function planBundleCleans(input: BundleFanoutInput): string[] {
  const { bundleListingId, componentListingIds, componentsWithLiveClean } = input;
  return componentListingIds
    .filter((id) => id !== bundleListingId)            // never clean the bundle listing itself
    .filter((id) => !componentsWithLiveClean.has(id))  // per-listing dedupe (independent components)
    .filter((id, i, arr) => arr.indexOf(id) === i);    // de-dupe repeated component ids
}
