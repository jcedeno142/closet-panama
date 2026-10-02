const categoryTerms: Record<string, string[]> = {
  men: ["men", "mens", "man", "male", "hombre", "hombres", "masculino", "caballero"],
  women: ["women", "womens", "woman", "female", "mujer", "mujeres", "femenino", "dama"],
  shoes: ["shoes", "shoe", "sneakers", "zapatos", "calzado", "zapatillas"],
  bags: ["bags", "bag", "handbags", "bolsos", "bolsas", "carteras"],
  accessories: ["accessories", "accessory", "accesorios"],
  kids: ["kids", "children", "boys", "girls", "niños", "niñas", "infantil"],
};

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchesProductSearch(
  product: {
    title: string;
    category: string | null;
    brand?: string | null;
    size?: string | null;
    city?: string | null;
    province?: string | null;
    seller_username?: string | null;
  },
  query: string,
): boolean {
  const tokens = normalize(query).split(" ").filter(Boolean);
  const text = normalize([
    product.title, product.brand, product.size, product.city,
    product.province, product.seller_username,
  ].filter(Boolean).join(" "));
  const categories = (categoryTerms[product.category || ""] || [product.category || ""])
    .map(normalize);

  // Category prefixes allow single-letter searching without matching "men" inside "women".
  return tokens.every(token => text.includes(token) || categories.some(term => term.startsWith(token)));
}
