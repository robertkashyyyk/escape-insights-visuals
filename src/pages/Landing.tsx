import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { StorySection } from "@/components/landing/StorySection";
import { PricingSection } from "@/components/landing/PricingSection";
import { CtaFooterSection } from "@/components/landing/CtaFooterSection";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground scroll-smooth">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <StorySection />
      <PricingSection />
      <CtaFooterSection />
    </div>
  );
}
