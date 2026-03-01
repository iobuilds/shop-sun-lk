import { useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContactForm from "@/components/ContactForm";

const StaticPage = () => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const location = useLocation();
  // If accessed via /contact directly, default to "contact-us" slug
  const slug = paramSlug || (location.pathname === "/contact" ? "contact-us" : undefined);

  const { data: page, isLoading } = useQuery({
    queryKey: ["page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("*")
        .eq("slug", slug!)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  // For contact page, show the form even if no DB page exists
  if (!page && slug === "contact-us") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-44 pb-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-3xl font-bold font-display text-foreground mb-4">Contact Us</h1>
              <p className="text-muted-foreground mb-8">Have a question or need help? Send us a message and we'll get back to you shortly.</p>
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold font-display text-foreground mb-6">Send Us a Message</h2>
                <ContactForm />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-36 pb-16 container mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold font-display text-foreground">Page Not Found</h1>
        </div>
        <Footer />
      </div>
    );
  }

  const renderContent = (content: string) => {
    return content.split("\n\n").map((block, i) => {
      if (block.startsWith("- ")) {
        const items = block.split("\n").filter((l) => l.startsWith("- "));
        return (
          <ul key={i} className="list-disc list-inside space-y-1 text-muted-foreground">
            {items.map((item, j) => (
              <li key={j}>{renderInline(item.slice(2))}</li>
            ))}
          </ul>
        );
      }
      if (/^\d+\./.test(block)) {
        const items = block.split("\n").filter((l) => /^\d+\./.test(l));
        return (
          <ol key={i} className="list-decimal list-inside space-y-1 text-muted-foreground">
            {items.map((item, j) => (
              <li key={j}>{renderInline(item.replace(/^\d+\.\s*/, ""))}</li>
            ))}
          </ol>
        );
      }
      return (
        <p key={i} className="text-muted-foreground leading-relaxed">
          {renderInline(block)}
        </p>
      );
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-44 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold font-display text-foreground mb-8">{page.title}</h1>
            <div className="space-y-4">{renderContent(page.content)}</div>
            {slug === "contact-us" && (
              <div className="mt-12 bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold font-display text-foreground mb-6">Send Us a Message</h2>
                <ContactForm />
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default StaticPage;
