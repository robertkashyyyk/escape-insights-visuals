import { motion } from "framer-motion";
import { BarChart3, TrendingUp, CalendarCheck, Users, Sparkles, Target } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: BarChart3,
    title: "Live Dashboard",
    description:
      "Total revenue, occupancy, ADR, and booking count — all live from Hostaway. Filter by property, owner, or date range. No formula required.",
  },
  {
    icon: TrendingUp,
    title: "Year-on-Year Analytics",
    description:
      "Revenue, ADR, and occupancy for every property compared against the same period last year. Smart badges: growth percentages, Pending, New, No Data.",
  },
  {
    icon: CalendarCheck,
    title: "Automated Cleaning Operations",
    description:
      "GPS-optimised routes generated every morning at 7 AM. Cleaners tap Complete on their phones. Properties update to clean in real time.",
  },
  {
    icon: Users,
    title: "Owner Portal",
    description:
      "Each owner logs in and sees only their properties — revenue, occupancy, reservations. Strict data isolation. Nothing from other owners is ever visible.",
  },
  {
    icon: Sparkles,
    title: "Orin — AI Intelligence",
    description:
      "Ask Orin anything about your portfolio in plain English. Monthly and quarterly briefs generated automatically. Your data has a voice.",
  },
  {
    icon: Target,
    title: "Revenue Pacing & Forecasting",
    description:
      "Forward pipeline of confirmed bookings, revenue pacing vs last year, and booking lead time analysis. Know what is coming before it arrives.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 md:py-28 relative">
      <div className="absolute inset-0">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/4 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Fifteen live views.{" "}
            <span className="text-muted-foreground">Each one replaces a spreadsheet.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass-card p-6 hover:border-primary/20 transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-base font-bold text-foreground mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
