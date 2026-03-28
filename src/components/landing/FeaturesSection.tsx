import { motion } from "framer-motion";
import { Upload, BarChart3, Users } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: Upload,
    title: "Seamless Ingestion",
    description:
      "Upload your Hostaway reservations in seconds. We automatically parse, clean, and enrich your data with intelligent date tracking.",
  },
  {
    icon: BarChart3,
    title: "The Anti-Grid Dashboard",
    description:
      "No more boring tables. Visualize your portfolio's performance with beautiful, interactive charts and KPI cards.",
  },
  {
    icon: Users,
    title: "Owner Portfolios",
    description:
      "Group your properties by owner. Instantly generate performance and payout reports that your clients will love.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-28 relative">
      <div className="absolute inset-0">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/4 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Stop manually updating cells.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Three powerful features that replace your spreadsheets forever.
          </p>
        </motion.div>

        <div className="space-y-24">
          {features.map((f, i) => {
            const isReversed = i % 2 !== 0;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: isReversed ? 40 : -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className={`flex flex-col md:flex-row items-center gap-12 ${
                  isReversed ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* Icon block */}
                <div className="flex-shrink-0">
                  <div className="h-24 w-24 rounded-2xl glass-card flex items-center justify-center border-primary/20">
                    <f.icon className="h-10 w-10 text-primary" />
                  </div>
                </div>

                {/* Text */}
                <div className={`flex-1 ${isReversed ? "md:text-right" : ""}`}>
                  <h3 className="font-display text-2xl font-bold mb-3 text-foreground">
                    {f.title}
                  </h3>
                  <p className="text-muted-foreground text-base leading-relaxed max-w-lg">
                    {f.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
