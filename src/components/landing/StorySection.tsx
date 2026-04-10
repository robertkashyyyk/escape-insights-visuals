import { motion } from "framer-motion";

export function StorySection() {
  return (
    <section id="testimonial" className="py-24 md:py-28 relative">
      <div className="absolute inset-0">
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Built with and for{" "}
            <span className="text-gradient-primary">Escape Ordinary</span>{" "}
            — 46 properties, 9,427 reservations, live since 2025.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="glass-card p-8 sm:p-10 border-l-4 border-l-primary"
        >
          <blockquote className="text-base sm:text-lg text-foreground leading-relaxed italic mb-6">
            "Escape Grids replaced a 20-sheet manual workbook we rebuilt every month. It now updates automatically, every night."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-display font-bold text-primary">R</span>
            </div>
            <div>
              <p className="text-sm font-display font-semibold text-foreground">Ryan</p>
              <p className="text-xs text-muted-foreground">Escape Ordinary · Fermanagh, Northern Ireland</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
