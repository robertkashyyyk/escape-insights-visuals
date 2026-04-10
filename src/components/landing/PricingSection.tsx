import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Shield, MapPin, Zap } from "lucide-react";

interface Tier {
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  annualSavings: string;
  properties: string;
  features: string[];
  cta: string;
  ctaStyle: "outline" | "default";
  popular?: boolean;
  footerNote: string;
}

const tiers: Tier[] = [
  {
    name: "Starter",
    monthlyPrice: "Free",
    annualPrice: "Free",
    annualSavings: "",
    properties: "Up to 5 properties",
    features: [
      "Hostaway API sync (nightly)",
      "Live dashboard",
      "Reservations view",
      "Basic YoY performance",
    ],
    cta: "Get Started Free",
    ctaStyle: "outline",
    footerNote: "No credit card required",
  },
  {
    name: "Operator",
    monthlyPrice: "£95",
    annualPrice: "£950",
    annualSavings: "save £190",
    properties: "Up to 25 properties",
    features: [
      "Everything in Starter",
      "Year-on-year analytics (full)",
      "Occupancy heatmap",
      "Owner portfolio grouping",
      "Cleaning schedule (GPS routes)",
      "Cleaner portal (mobile)",
      "Orin AI assistant",
      "Unlimited owner portal logins",
    ],
    cta: "Start Free Trial",
    ctaStyle: "default",
    footerNote: "14-day free trial · Cancel anytime",
  },
  {
    name: "Agency",
    monthlyPrice: "£195",
    annualPrice: "£1,950",
    annualSavings: "save £390",
    properties: "Up to 75 properties",
    popular: true,
    features: [
      "Everything in Operator",
      "Management revenue tracking",
      "Cleaning Numbers (financials)",
      "Orin Brief (monthly + quarterly)",
      "Revenue pacing & forecasting",
      "Revenue forecaster",
      "Priority support",
    ],
    cta: "Start Free Trial",
    ctaStyle: "default",
    footerNote: "14-day free trial · Cancel anytime",
  },
  {
    name: "Enterprise",
    monthlyPrice: "£495",
    annualPrice: "£4,950",
    annualSavings: "save £990",
    properties: "Unlimited properties",
    features: [
      "Everything in Agency",
      "Unlimited properties",
      "White-label option",
      "Custom Hostaway integrations",
      "Dedicated onboarding & support",
      "SLA guarantee",
      "Custom reporting",
    ],
    cta: "Book a Call",
    ctaStyle: "outline",
    footerNote: "Custom contracts available",
  },
];

const trustItems = [
  { icon: Shield, text: "Your data, your Supabase. We never touch your reservations." },
  { icon: MapPin, text: "Built for UK & Ireland STR managers. GBP pricing. GDPR compliant." },
  { icon: Zap, text: "Connected to Hostaway in under 10 minutes." },
];

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24 md:py-28 relative">
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/5 blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Simple pricing. <span className="text-gradient-primary">Serious value.</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Every plan includes Hostaway API sync, live analytics, and the full feature set for your tier. No per-property add-ons. No hidden fees. Annual billing saves 2 months.
          </p>
        </motion.div>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-sm font-medium transition-colors ${!annual ? "text-foreground" : "text-muted-foreground"}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
              annual ? "bg-primary" : "bg-secondary"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-foreground transition-transform duration-300 ${
                annual ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${annual ? "text-foreground" : "text-muted-foreground"}`}>
            Annual
          </span>
          {annual && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              Save 2 months
            </span>
          )}
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`glass-card p-6 flex flex-col relative ${
                tier.popular
                  ? "border-primary/40 shadow-[0_0_40px_-8px_hsl(var(--primary)/0.2)] lg:scale-[1.03]"
                  : ""
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 right-4 text-[10px] font-semibold uppercase tracking-widest bg-primary text-primary-foreground px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}

              <h3 className="font-display text-lg font-bold text-foreground mb-1">
                {tier.name}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">{tier.properties}</p>

              <div className="mb-1">
                {tier.monthlyPrice === "Free" ? (
                  <div>
                    <span className="text-3xl font-display font-extrabold text-foreground">Free</span>
                    <span className="text-sm text-muted-foreground ml-1">· Forever</span>
                  </div>
                ) : annual ? (
                  <div>
                    <span className="text-3xl font-display font-extrabold text-foreground">{tier.annualPrice}</span>
                    <span className="text-sm text-muted-foreground">/yr</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground line-through">{tier.monthlyPrice}/mo</span>
                      <span className="text-xs text-primary font-medium">{tier.annualSavings}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl font-display font-extrabold text-foreground">{tier.monthlyPrice}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                    {tier.annualSavings && (
                      <p className="text-xs text-muted-foreground mt-1">
                        or {tier.annualPrice}/yr ({tier.annualSavings})
                      </p>
                    )}
                  </div>
                )}
              </div>

              <ul className="space-y-2.5 my-6 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.ctaStyle === "default" ? "default" : "outline"}
                className={`w-full ${tier.popular ? "h-11 text-sm font-semibold" : ""}`}
              >
                {tier.cta}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">{tier.footerNote}</p>
            </motion.div>
          ))}
        </div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {trustItems.map((item) => (
            <div key={item.text} className="flex items-start gap-3 glass-card p-4">
              <item.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
