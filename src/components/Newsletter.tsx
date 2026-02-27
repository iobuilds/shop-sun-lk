import { motion } from "framer-motion";
import { Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Newsletter = () => (
  <section>
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="hero-gradient rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] rounded-full bg-secondary blur-3xl" />
        <div className="absolute bottom-[-30px] left-[-30px] w-[150px] h-[150px] rounded-full bg-accent blur-2xl" />
      </div>
      <div className="relative max-w-xl mx-auto">
        <Mail className="w-10 h-10 text-secondary mx-auto mb-4" />
        <h2 className="text-2xl sm:text-3xl font-bold font-display text-primary-foreground mb-3">
          Stay Updated with TechLK
        </h2>
        <p className="text-primary-foreground/70 text-sm sm:text-base mb-6">
          Subscribe to get exclusive deals, new arrivals, and electronics tips delivered to your inbox.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email address"
            className="flex-1 h-11 px-4 rounded-lg bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          <Button variant="hero" className="gap-1">
            Subscribe <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  </section>
);

export default Newsletter;
