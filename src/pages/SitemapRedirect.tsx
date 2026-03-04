import { useEffect } from "react";

const SitemapRedirect = () => {
  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "rcefmfiqqqsfurkdljup";
    window.location.href = `https://${projectId}.supabase.co/functions/v1/generate-sitemap`;
  }, []);

  return null;
};

export default SitemapRedirect;
