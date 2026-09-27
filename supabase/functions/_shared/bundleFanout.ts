// Canonical bundle fan-out rule — imported BOTH by the edge scheduler
// (generate-daily-cleaning-schedule) and by the vitest regression test, so breaking
// this rule breaks the real fan-out and fails the test.
//
// A booking on a bundle listing must produce exactly one clean per COMPONENT that
// doesn't already have a live clean for that booking — never a clean on the bundle
// listing itself, and having one component's clean must not suppress the others.
export interface BundleFanoutInput {
  bundleListingId: string;               // "" (or any id not in the list) for a non-bundle booking
  componentListingIds: string[];
  componentsWithLiveClean: Set<string>;  // component ids that already have a LIVE clean for this booking
}

/** Returns the component listing ids that should get a NEW clean for this booking. */
export function planBundleCleans(input: BundleFanoutInput): string[] {
  const { bundleListingId, componentListingIds, componentsWithLiveClean } = input;
  return componentListingIds
    .filter((id) => id !== bundleListingId)            // never clean the bundle listing itself
    .filter((id) => !componentsWithLiveClean.has(id))  // per-listing dedupe (independent components)
    .filter((id, i, arr) => arr.indexOf(id) === i);    // de-dupe repeated component ids
}
