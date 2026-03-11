import { Link } from "react-router-dom";
import { Facebook, Instagram, Youtube, Mail, Phone, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Footer = () => {
  const { data: company } = useQuery({
    queryKey: ["site-company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings" as any)
        .select("*")
        .eq("key", "company")
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.value as any || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const storeName = company?.store_name || "NanoCircuit.lk";
  const description = company?.description || "Sri Lanka's trusted electronics & components store. Arduino, sensors, 3D printing supplies and more.";
  const address = company?.address || "No. 42, Galle Road, Colombo 03, Sri Lanka";
  const phone = company?.phone || "+94 77 123 4567";
  const email = company?.email || "info@nanocircuit.lk";
  const copyright = company?.copyright_text || `© ${new Date().getFullYear()} ${storeName}. All rights reserved.`;
  const facebookUrl = company?.facebook_url || "#";
  const instagramUrl = company?.instagram_url || "#";
  const youtubeUrl = company?.youtube_url || "#";

  const socialLinks = [
    { icon: Facebook, url: facebookUrl },
    { icon: Instagram, url: instagramUrl },
    { icon: Youtube, url: youtubeUrl },
  ];

  return (
    <footer className="bg-primary text-primary-foreground mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              {company?.logo_url ? (
                <img src={company.logo_url} alt={storeName} className="h-9 w-auto object-contain" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                  <span className="text-secondary-foreground font-bold text-lg font-display">{storeName.charAt(0)}</span>
                </div>
              )}
              <span className="text-xl font-bold font-display">{storeName}</span>
            </div>
            <p className="text-primary-foreground/60 text-sm mb-4 leading-relaxed">{description}</p>
            <div className="flex gap-3">
              {socialLinks.map(({ icon: Icon, url }, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-primary-foreground/10 hover:bg-secondary flex items-center justify-center transition-colors">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold font-display mb-4">Quick Links</h4>
            <ul className="space-y-2.5 text-sm text-primary-foreground/60">
              <li><Link to="/page/about-us" className="hover:text-primary-foreground transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-primary-foreground transition-colors">Contact Us</Link></li>
              <li><Link to="/track-order" className="hover:text-primary-foreground transition-colors">Track Order</Link></li>
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">Daily Deals</Link></li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h4 className="font-semibold font-display mb-4">Policies</h4>
            <ul className="space-y-2.5 text-sm text-primary-foreground/60">
              <li><Link to="/page/privacy-policy" className="hover:text-primary-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/page/refund-policy" className="hover:text-primary-foreground transition-colors">Refund Policy</Link></li>
              <li><Link to="/page/terms" className="hover:text-primary-foreground transition-colors">Terms & Conditions</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold font-display mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/60">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-primary-foreground transition-colors">{phone}</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <a href={`mailto:${email}`} className="hover:text-primary-foreground transition-colors">{email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-primary-foreground/40">
          <span>{copyright}</span>
          <span>Payments powered by Stripe • Island-wide delivery</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
