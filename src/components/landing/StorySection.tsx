import { motion } from "framer-motion";

export function StorySection() {
  return (
    <section id="story" className="py-28 relative">
      <div className="absolute inset-0">
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="glass-card p-10 sm:p-16 text-center border-primary/10"
        >
          <span className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-accent mb-6">
            Our Story
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-8">
            Built by{" "}
            <span className="text-gradient-primary">Escape Ordinary</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Escape Grids wasn't built by software engineers guessing what property managers need. It was built by{" "}
            <span className="text-foreground font-medium">Escape Ordinary</span>—a premium short-term rental management company—to solve our own biggest headache. We built the tool we wished existed.
          </p>
          <div className="mt-10 h-px w-24 mx-auto bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}
