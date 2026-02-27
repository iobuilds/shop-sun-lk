import { useEffect, useMemo } from "react";

const STORAGE_KEY = "recently-viewed-products";
const MAX_ITEMS = 10;

interface RecentProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  discount_price?: number | null;
  image: string;
  rating?: number | null;
  review_count?: number | null;
}

export const useRecentlyViewed = (currentProduct?: {
  id: string;
  slug: string;
  name: string;
  price: number;
  discount_price?: number | null;
  images?: string[] | null;
  rating?: number | null;
  review_count?: number | null;
}) => {
  useEffect(() => {
    if (!currentProduct) return;
    const stored: RecentProduct[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const filtered = stored.filter((p) => p.id !== currentProduct.id);
    filtered.unshift({
      id: currentProduct.id,
      slug: currentProduct.slug,
      name: currentProduct.name,
      price: currentProduct.price,
      discount_price: currentProduct.discount_price,
      image: currentProduct.images?.[0] || "/placeholder.svg",
      rating: currentProduct.rating,
      review_count: currentProduct.review_count,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
  }, [currentProduct?.id]);

  const recentProducts = useMemo(() => {
    const stored: RecentProduct[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return currentProduct ? stored.filter((p) => p.id !== currentProduct.id) : stored;
  }, [currentProduct?.id]);

  return recentProducts;
};
