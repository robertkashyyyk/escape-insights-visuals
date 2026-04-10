import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

const before = [
  "Hours spent on CSV exports from Hostaway every month",
  "Year-on-year comparisons built manually with VLOOKUP",
  "No live data — always at least a month behind",
  "Cleaning schedules managed over WhatsApp",
  "Owner reports produced by hand on the 15th",
  "Zero visibility into what is coming next",
];

const after = [
  "Hostaway API connected — data syncs automatically every night",
  "YoY performance calculated per property, automatically",
  "Live dashboard — always current, always accurate",
  "GPS-optimised cleaning schedules generated at 7 AM",
  "Owner portal — owners see their own data, nothing else",
  "Revenue pacing, forecasting, and AI intelligence built in",
];

export function ProblemSection() {
  return (
    <section className="py-24 md:py-28 relative">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/4 w-[500px] h-[400px] rounded-full bg-destructive/3 blur-[120px]" />
        <div className="absolute top-1/2 right-1/4 w-[500px] h-[400px] rounded-full bg-primary/4 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 max-w-4xl mx-auto">
            You're running a 7-figure portfolio from a spreadsheet{" "}
            <span className="text-muted-foreground">rebuilt every month.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="glass-card p-6 sm:p-8 border-destructive/20"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <X className="h-4 w-4 text-destructive" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">The Spreadsheet</h3>
            </div>
            <ul className="space-y-4">
              {before.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <X className="h-4 w-4 text-destructive/60 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="glass-card p-6 sm:p-8 border-primary/20"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">Escape Grids</h3>
            </div>
            <ul className="space-y-4">
              {after.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
