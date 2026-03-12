import { Truck, Shield, Headphones, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Truck,        title: "Island-Wide Delivery",  desc: "Free shipping over Rs. 5,000",  color: "bg-secondary/10 text-secondary" },
  { icon: Shield,       title: "Genuine Products",       desc: "100% authentic guaranteed",     color: "bg-success/10 text-success" },
  { icon: Headphones,   title: "24/7 Support",           desc: "WhatsApp & phone support",      color: "bg-accent/15 text-accent-foreground" },
  { icon: CreditCard,   title: "Secure Payments",        desc: "Stripe & bank transfer",        color: "bg-primary/10 text-primary" },
];

const TrustBanner = () => (
  <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    {features.map((f, i) => {
      const Icon = f.icon;
      return (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.07, duration: 0.35 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-secondary/30 hover:shadow-sm transition-all duration-300"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${f.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{f.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
          </div>
        </motion.div>
      );
    })}
  </section>
);

export default TrustBanner;
