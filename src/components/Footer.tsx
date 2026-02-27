import { Link } from "react-router-dom";
import { Facebook, Instagram, Youtube, Mail, Phone, MapPin } from "lucide-react";

const Footer = () => (
  <footer className="bg-primary text-primary-foreground mt-16">
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
              <span className="text-secondary-foreground font-bold text-lg font-display">T</span>
            </div>
            <span className="text-xl font-bold font-display">TechLK</span>
          </div>
          <p className="text-primary-foreground/60 text-sm mb-4 leading-relaxed">
            Sri Lanka's trusted electronics & components store. Arduino, sensors, 3D printing supplies and more.
          </p>
          <div className="flex gap-3">
            {[Facebook, Instagram, Youtube].map((Icon, i) => (
              <a key={i} href="#" className="w-9 h-9 rounded-lg bg-primary-foreground/10 hover:bg-secondary flex items-center justify-center transition-colors">
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
            <li><Link to="/page/contact" className="hover:text-primary-foreground transition-colors">Contact Us</Link></li>
            <li><Link to="/profile" className="hover:text-primary-foreground transition-colors">Track Order</Link></li>
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
              <span>No. 42, Galle Road, Colombo 03, Sri Lanka</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span>+94 77 123 4567</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span>info@techlk.lk</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-primary-foreground/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-primary-foreground/40">
        <span>© 2026 TechLK. All rights reserved.</span>
        <span>Payments powered by Stripe • Island-wide delivery</span>
      </div>
    </div>
  </footer>
);

export default Footer;
