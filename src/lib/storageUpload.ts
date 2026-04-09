import { supabase } from "@/integrations/supabase/client";

/**
 * Normalise storage public URLs for self-hosted VPS.
 * Supabase JS builds the URL from the SUPABASE_URL env var, which on a
 * VPS may be an internal Docker hostname (e.g. http://kong:8000).
 * We replace that with the browser-visible origin so images load correctly.
 */
function normalisePublicUrl(raw: string): string {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return raw;
    // If the raw URL already starts with the configured URL, it's fine
    if (raw.startsWith(supabaseUrl)) return raw;
    // Extract the path portion after /storage/
    const marker = "/storage/";
    const idx = raw.indexOf(marker);
    if (idx === -1) return raw;
    return `${supabaseUrl}${raw.substring(idx)}`;
  } catch {
    return raw;
  }
}

/**
 * Upload a file to the `images` storage bucket and return the public URL.
 * Handles VPS URL normalisation and provides consistent error messages.
 */
export async function uploadToStorage(
  file: File,
  folder: string
): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from("images")
    .upload(fileName, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream",
    });

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error(error.message || "Upload failed");
  }

  const { data } = supabase.storage.from("images").getPublicUrl(fileName);
  return normalisePublicUrl(data.publicUrl);
}
