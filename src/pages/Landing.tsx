import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { StorySection } from "@/components/landing/StorySection";
import { CtaFooterSection } from "@/components/landing/CtaFooterSection";

export default function Landing() {
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
