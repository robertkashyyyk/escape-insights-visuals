import { describe, it, expect } from "vitest";
import { planBundleCleans } from "@/lib/bundleFanout";

// Regression guard for the Ernie's Den & Lily's Pad bundle bug: a bundle booking must
// fan out to every component that needs a clean, and completing/having one component's
// clean must not suppress the other. The bundle listing itself never gets a clean.
const BUNDLE = "bundle-ed-lp";
const ERNIES = "ernies-den";
const LILYS = "lilys-pad";

describe("bundle fan-out", () => {
  it("creates a clean for every component when none exist", () => {
    const plan = planBundleCleans({
      bundleListingId: BUNDLE,
      componentListingIds: [ERNIES, LILYS],
      componentsWithLiveClean: new Set(),
    });
    expect(plan.sort()).toEqual([ERNIES, LILYS].sort());
  });

  it("only creates the missing component when the other is already clean", () => {
    const plan = planBundleCleans({
      bundleListingId: BUNDLE,
      componentListingIds: [ERNIES, LILYS],
      componentsWithLiveClean: new Set([ERNIES]),
    });
    expect(plan).toEqual([LILYS]); // Ernie's already has one → not suppressed for Lily's
  });

  it("creates nothing when both components already have a clean", () => {
    const plan = planBundleCleans({
      bundleListingId: BUNDLE,
      componentListingIds: [ERNIES, LILYS],
      componentsWithLiveClean: new Set([ERNIES, LILYS]),
    });
    expect(plan).toEqual([]);
  });

  it("never schedules a clean on the bundle listing itself", () => {
    const plan = planBundleCleans({
      bundleListingId: BUNDLE,
      componentListingIds: [BUNDLE, ERNIES, LILYS],
      componentsWithLiveClean: new Set(),
    });
    expect(plan).not.toContain(BUNDLE);
    expect(plan.sort()).toEqual([ERNIES, LILYS].sort());
  });
});
