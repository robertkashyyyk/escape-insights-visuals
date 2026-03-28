import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface Tier {
  name: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

const tiers: Tier[] = [
  {
    name: "Starter",
    price: "Free",
    features: [
      "Up to 5 properties",
      "Basic dashboard & CSV uploads",
      "Perfect for independent hosts",
    ],
    cta: "Get Started",
  },
  {
    name: "Premium",
    price: "$49",
    period: "/mo",
    features: [
      "Up to 20 properties",
      "Owner portfolio grouping",
      "Year-over-year analytics",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Professional",
    price: "$99",
    period: "/mo",
    features: [
      "Up to 100 properties",
      "Owner portfolio grouping",
      "Pro Dashboards",
      "All analytics",
    ],
    cta: "Start Free Trial",
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: [
      "Unlimited properties",
      "Custom data integrations",
      "Dedicated support",
    ],
    cta: "Contact Us",
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-28 relative">
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/5 blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Simple pricing for portfolios of any size.
          </h2>
          <p className="text-muted-foreground text-lg">
            Start free. Scale when you're ready.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`glass-card-hover p-6 flex flex-col relative ${
                tier.popular
                  ? "border-primary/40 shadow-[0_0_30px_-8px_hsl(var(--glow-primary)/0.25)]"
                  : ""
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-widest bg-primary text-primary-foreground px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}

              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                {tier.name}
              </h3>
              <div className="mb-6">
                <span className="text-3xl font-display font-extrabold text-foreground">
                  {tier.price}
                </span>
                {tier.period && (
                  <span className="text-sm text-muted-foreground">{tier.period}</span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.popular ? "default" : "outline"}
                className="w-full"
              >
                {tier.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
