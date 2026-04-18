import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { StorySection } from "@/components/landing/StorySection";
import { CtaFooterSection } from "@/components/landing/CtaFooterSection";
import { useEffect } from "react";

export default function Landing() {
  // Landing page is always dark — marketing aesthetic
  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("light");
    if (had) {
      root.classList.remove("light");
      root.classList.add("dark");
    }
    return () => {
      if (had) {
        root.classList.remove("dark");
        root.classList.add("light");
      }
    };
  }, []);
  return (
    <div className="min-h-screen bg-background text-foreground scroll-smooth">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <PricingSection />
      <StorySection />
      <CtaFooterSection />
    </div>
  );
}
