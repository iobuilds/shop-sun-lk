import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const Newsletter = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <section>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="hero-gradient rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden"
      >
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-60px] right-[-60px] w-[220px] h-[220px] rounded-full bg-secondary/20 blur-3xl" />
          <div className="absolute bottom-[-40px] left-[-40px] w-[180px] h-[180px] rounded-full bg-accent/15 blur-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/30 blur-3xl" />
        </div>
        <div className="relative max-w-xl mx-auto">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <CheckCircle className="w-12 h-12 text-secondary" />
              <h2 className="text-2xl font-bold font-display text-primary-foreground">You're subscribed!</h2>
              <p className="text-primary-foreground/70 text-sm">We'll send you exclusive deals and updates. Welcome aboard!</p>
            </motion.div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-secondary/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-secondary/30">
                <Mail className="w-6 h-6 text-secondary" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-primary-foreground mb-3">
                Get Exclusive Deals
              </h2>
              <p className="text-primary-foreground/70 text-sm sm:text-base mb-6">
                Subscribe for new arrivals, flash sales, and electronics tips delivered to your inbox.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="flex-1 h-11 px-4 rounded-lg bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 text-sm focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                />
                <Button type="submit" variant="hero" className="gap-1.5 shadow-xl whitespace-nowrap">
                  Subscribe <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
              <p className="text-primary-foreground/40 text-xs mt-3">No spam, unsubscribe anytime.</p>
            </>
          )}
        </div>
      </motion.div>
    </section>
  );
};

export default Newsletter;
