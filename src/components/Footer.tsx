import { Link } from "react-router-dom";
import { Facebook, Instagram, Youtube, Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import BrandText from "@/components/BrandText";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Footer = () => {
  const { storeName, logoUrl, company } = useBranding();

  const { data: pmSettings } = useQuery({
    queryKey: ["payment-methods-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings" as any).select("value").eq("key", "payment_methods").maybeSingle();
      return (data as any)?.value as any || { stripe_enabled: true, bank_transfer_enabled: true };
    },
    staleTime: 5 * 60 * 1000,
  });

  const showStripe = pmSettings?.stripe_enabled !== false;
  const showPayhere = pmSettings?.payhere_enabled === true;
  const showBank = pmSettings?.bank_transfer_enabled !== false;
  const showCod = pmSettings?.cod_enabled === true;

  const description = company?.description || "Sri Lanka's trusted electronics & components store. Arduino, sensors, 3D printing supplies and more.";
  const address = company?.address || "No. 42, Galle Road, Colombo 03, Sri Lanka";
  const phone = company?.phone || "+94 77 123 4567";
  const email = company?.email || "info@nanocircuit.lk";
  const copyright = company?.copyright_text || `© ${new Date().getFullYear()} ${storeName}. All rights reserved.`;
  const facebookUrl = company?.facebook_url || "#";
  const instagramUrl = company?.instagram_url || "#";
  const youtubeUrl = company?.youtube_url || "#";

  const socialLinks = [
    { icon: Facebook, url: facebookUrl, label: "Facebook" },
    { icon: Instagram, url: instagramUrl, label: "Instagram" },
    { icon: Youtube, url: youtubeUrl, label: "YouTube" },
  ];

  const quickLinks = [
    { label: "About Us",     to: "/page/about-us" },
    { label: "Contact Us",   to: "/contact" },
    { label: "Track Order",  to: "/track-order" },
    { label: "Daily Deals",  to: "/deals" },
    { label: "Pre-Order",    to: "/pre-order" },
    { label: "PCB Order",    to: "/pcb-order" },
  ];

  const policyLinks = [
    { label: "Privacy Policy",    to: "/page/privacy-policy" },
    { label: "Refund Policy",     to: "/page/refund-policy" },
    { label: "Terms & Conditions",to: "/page/terms" },
  ];

  return (
    <footer className="bg-primary text-primary-foreground mt-16">
      {/* Top accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              {company?.navbar_brand_mode === "text_only" ? (
                <BrandText storeName={storeName} showTagline size="md" />
              ) : logoUrl ? (
                <img src={logoUrl} alt={storeName} className="h-10 w-auto object-contain max-w-[240px]" style={{ filter: "brightness(0) invert(1)" }} />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                  <span className="text-secondary-foreground font-bold text-lg font-display">{storeName.charAt(0)}</span>
                </div>
              )}
              {company?.navbar_brand_mode === "logo_text" && (
                <BrandText storeName={storeName} size="md" />
              )}
            </div>
            <p className="text-primary-foreground/55 text-sm mb-5 leading-relaxed">{description}</p>
            <div className="flex gap-2">
              {socialLinks.map(({ icon: Icon, url, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg bg-primary-foreground/10 hover:bg-secondary hover:text-secondary-foreground flex items-center justify-center transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold font-display mb-4 text-primary-foreground">Quick Links</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/55">
              {quickLinks.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="hover:text-primary-foreground hover:translate-x-0.5 transition-all duration-150 flex items-center gap-1 group">
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-4 group-hover:ml-0 transition-all duration-150" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h4 className="font-semibold font-display mb-4 text-primary-foreground">Policies</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/55">
              {policyLinks.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="hover:text-primary-foreground transition-colors duration-150">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            {/* Payment badges — dynamic based on admin settings */}
            <div className="mt-6">
              <p className="text-xs text-primary-foreground/40 mb-2">We accept</p>
              <div className="flex flex-wrap items-center gap-2">
                {(showStripe || showPayhere) && (
                  <span className="bg-primary-foreground/10 text-primary-foreground/60 text-[10px] font-semibold px-2 py-1 rounded border border-primary-foreground/15">VISA</span>
                )}
                {(showStripe || showPayhere) && (
                  <span className="bg-primary-foreground/10 text-primary-foreground/60 text-[10px] font-semibold px-2 py-1 rounded border border-primary-foreground/15">MC</span>
                )}
                {showBank && (
                  <span className="bg-primary-foreground/10 text-primary-foreground/60 text-[10px] font-semibold px-2 py-1 rounded border border-primary-foreground/15">Bank</span>
                )}
                {showCod && (
                  <span className="bg-primary-foreground/10 text-primary-foreground/60 text-[10px] font-semibold px-2 py-1 rounded border border-primary-foreground/15">COD</span>
                )}
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold font-display mb-4 text-primary-foreground">Contact Us</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/55">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-secondary/70" />
                <span>{address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 flex-shrink-0 text-secondary/70" />
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-primary-foreground transition-colors">{phone}</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 flex-shrink-0 text-secondary/70" />
                <a href={`mailto:${email}`} className="hover:text-primary-foreground transition-colors">{email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-primary-foreground/35">
          <span>{copyright}</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary/50 inline-block" />
            Payments powered by Stripe
            <span className="w-1.5 h-1.5 rounded-full bg-secondary/50 inline-block" />
            Island-wide delivery
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
