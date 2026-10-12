export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
}

export interface PublicCategory {
  id: string;
  name: string;
  products: PublicProduct[];
}

export interface PublicMenu {
  shop: { name: string; currency: string };
  categories: PublicCategory[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function fetchMenu(slug: string): Promise<PublicMenu | null> {
  try {
    const res = await fetch(`${API_URL}/api/public/menu/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { success: boolean; data: PublicMenu };
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}
