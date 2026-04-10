import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap, Building2, Link2, Sparkles } from "lucide-react";

const stats = [
  { value: "9,427", label: "Reservations Synced", icon: Zap },
  { value: "46", label: "Properties Live", icon: Building2 },
  { value: "100%", label: "Hostaway Connected", icon: Link2 },
  { value: "AI", label: "Powered Intelligence", icon: Sparkles },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
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
            Built for serious STR managers
          </span>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6">
            Stop managing your portfolio
            <br />
            <span className="text-gradient-primary">in a spreadsheet.</span>
          </h1>
          <p className="max-w-3xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed mb-10">
            Escape Grids connects to Hostaway, syncs your reservations automatically, and gives you the analytics, operations, and owner intelligence you actually need — in one platform built for serious STR managers.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base px-8 h-12 font-semibold" asChild>
              <a href="#pricing">Start Free — No Credit Card</a>
            </Button>
            <Button variant="outline" size="lg" className="text-base px-8 h-12" asChild>
              <a href="#features">See How It Works</a>
            </Button>
          </div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
          className="mt-20 glass-card p-6 sm:p-8 max-w-4xl mx-auto"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xl sm:text-2xl font-display font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
