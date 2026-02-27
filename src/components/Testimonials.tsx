import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  { name: "Kasun Perera", role: "IoT Developer", text: "Best electronics store in Sri Lanka. Fast delivery and genuine products. My go-to for Arduino components!", rating: 5 },
  { name: "Dilini Fernando", role: "Engineering Student", text: "Amazing combo packs for university projects. Saved me so much time and money. Highly recommended!", rating: 5 },
  { name: "Ravindu Silva", role: "Maker & Hobbyist", text: "The 3D printing supplies are top quality. Great customer support via WhatsApp too. Love this store!", rating: 4 },
];

const Testimonials = () => (
  <section>
    <h2 className="text-2xl font-bold font-display text-foreground mb-6 text-center">What Our Customers Say</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {testimonials.map((t, i) => (
        <motion.div
          key={t.name}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className="bg-card rounded-xl border border-border p-6 card-elevated"
        >
          <Quote className="w-8 h-8 text-secondary/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">"{t.text}"</p>
          <div className="flex items-center gap-1 mb-3">
            {[...Array(5)].map((_, j) => (
              <Star key={j} className={`w-3.5 h-3.5 ${j < t.rating ? "text-accent fill-accent" : "text-border"}`} />
            ))}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.role}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </section>
);

export default Testimonials;
