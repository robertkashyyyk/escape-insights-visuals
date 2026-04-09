import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TrendingUp, Home, PoundSterling } from "lucide-react";

const kpis = [
  { label: "Revenue", value: "£142K", icon: PoundSterling, delay: 0.3 },
  { label: "Occupancy", value: "87%", icon: Home, delay: 0.5 },
  { label: "ADR", value: "£189", icon: TrendingUp, delay: 0.7 },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-accent/6 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <span className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-primary mb-6 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5">
            Built by property managers, for property managers
          </span>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6">
            Escape the spreadsheet.
            <br />
            <span className="text-gradient-primary">Master your property data.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed mb-10">
            The intelligent analytics dashboard for short-term rental managers who want to stop doing data entry and start driving revenue.
            <br />
            Built by the team at{" "}
            <span className="text-foreground font-medium">Escape Ordinary</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base px-8 h-12 font-semibold" asChild>
              <a href="#pricing">Start for Free</a>
            </Button>
            <Button variant="outline" size="lg" className="text-base px-8 h-12" asChild>
              <a href="#features">See How It Works</a>
            </Button>
          </div>
        </motion.div>

        {/* Floating KPI cards */}
        <div className="mt-20 flex flex-col sm:flex-row gap-6 justify-center items-center">
          {kpis.map((kpi) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: kpi.delay, ease: "easeOut" }}
              className="glass-card p-6 w-48 text-center group hover:border-primary/30 transition-all duration-500"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <kpi.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</p>
              <p className="text-2xl font-display font-bold text-foreground">{kpi.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
