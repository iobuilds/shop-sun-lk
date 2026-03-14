import { motion } from "framer-motion";
import { Clock, Mail, Phone } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import SEOHead from "@/components/SEOHead";

interface ComingSoonProps {
  title?: string;
  subtitle?: string;
}

export default function ComingSoon({ title = "Coming Soon", subtitle = "We're working on something amazing. Stay tuned!" }: ComingSoonProps) {
  const { storeName, company } = useBranding();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <SEOHead title={`${title} — ${storeName}`} description={subtitle} />

      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-xl mx-auto space-y-8">
        {/* Logo / Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {company?.logo_url ? (
            <img src={company.logo_url} alt={storeName} className="h-16 mx-auto object-contain" />
          ) : (
            <h1 className="text-2xl font-bold text-primary font-display">{storeName}</h1>
          )}
        </motion.div>

        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="flex justify-center"
        >
          <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
            <Clock className="w-12 h-12 text-primary" />
          </div>
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-3"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-foreground font-display">{title}</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">{subtitle}</p>
        </motion.div>

        {/* Contact Info */}
        {(company?.phone || company?.email) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-4 pt-2"
          >
            {company?.phone && (
              <a
                href={`tel:${company.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4" />
                {company.phone}
              </a>
            )}
            {company?.email && (
              <a
                href={`mailto:${company.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="w-4 h-4" />
                {company.email}
              </a>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
