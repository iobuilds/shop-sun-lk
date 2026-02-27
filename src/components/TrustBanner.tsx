import { Truck, Shield, Headphones, CreditCard } from "lucide-react";

const features = [
  { icon: Truck, title: "Island-Wide Delivery", desc: "Free shipping over Rs. 5,000" },
  { icon: Shield, title: "Genuine Products", desc: "100% authentic guaranteed" },
  { icon: Headphones, title: "24/7 Support", desc: "WhatsApp & phone support" },
  { icon: CreditCard, title: "Secure Payments", desc: "Stripe & bank transfer" },
];

const TrustBanner = () => (
  <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {features.map((f) => {
      const Icon = f.icon;
      return (
        <div key={f.title} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{f.title}</p>
            <p className="text-xs text-muted-foreground">{f.desc}</p>
          </div>
        </div>
      );
    })}
  </section>
);

export default TrustBanner;
