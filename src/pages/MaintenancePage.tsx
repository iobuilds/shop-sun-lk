import { motion } from "framer-motion";
import { Wrench, Mail, Phone, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/useBranding";
import SEOHead from "@/components/SEOHead";

interface MaintenancePageProps {
  title?: string;
  message?: string;
}

export default function MaintenancePage({
  title = "Site Under Maintenance",
  message = "We're performing scheduled maintenance. We'll be back shortly. For urgent inquiries, please contact us.",
}: MaintenancePageProps) {
  const { storeName, company } = useBranding();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <SEOHead title={`${title} — ${storeName}`} description={message} />

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-destructive/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-xl mx-auto space-y-8">
        {/* Brand */}
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

        {/* Icon with animated gears */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="flex justify-center"
        >
          <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Wrench className="w-12 h-12 text-amber-500" />
            </motion.div>
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
          <p className="text-lg text-muted-foreground leading-relaxed">{message}</p>
        </motion.div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button asChild size="lg" className="gap-2">
            <Link to="/contact">
              <MessageCircle className="w-4 h-4" />
              Contact Us
            </Link>
          </Button>

          {company?.phone && (
            <Button asChild variant="outline" size="lg" className="gap-2">
              <a href={`tel:${company.phone}`}>
                <Phone className="w-4 h-4" />
                {company.phone}
              </a>
            </Button>
          )}
        </motion.div>

        {/* Email */}
        {company?.email && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <a
              href={`mailto:${company.email}`}
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="w-4 h-4" />
              {company.email}
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}
