import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/xml",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const baseUrl = req.headers.get("origin") || "https://techlk.lk";
  const today = new Date().toISOString().split("T")[0];

  const urls: string[] = [];

  // Static pages
  const staticPages = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/auth", priority: "0.3", changefreq: "monthly" },
    { loc: "/cart", priority: "0.3", changefreq: "monthly" },
    { loc: "/wishlist", priority: "0.3", changefreq: "monthly" },
  ];

  staticPages.forEach((p) => {
    urls.push(`<url><loc>${baseUrl}${p.loc}</loc><lastmod>${today}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`);
  });

  // Categories
  const { data: categories } = await supabase.from("categories").select("slug, updated_at").eq("is_active", true);
  categories?.forEach((c) => {
    urls.push(`<url><loc>${baseUrl}/category/${c.slug}</loc><lastmod>${c.updated_at?.split("T")[0] || today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  });

  // Products
  const { data: products } = await supabase.from("products").select("slug, updated_at").eq("is_active", true);
  products?.forEach((p) => {
    urls.push(`<url><loc>${baseUrl}/product/${p.slug}</loc><lastmod>${p.updated_at?.split("T")[0] || today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  });

  // Static CMS pages
  const { data: pages } = await supabase.from("pages").select("slug, updated_at").eq("is_published", true);
  pages?.forEach((p) => {
    urls.push(`<url><loc>${baseUrl}/page/${p.slug}</loc><lastmod>${p.updated_at?.split("T")[0] || today}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`);
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(sitemap, { headers: corsHeaders });
});
