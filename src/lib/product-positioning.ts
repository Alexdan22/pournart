type ProductForPositioning = {
  name: string;
  price: number;
  category?: { name: string };
};

export function getProductValueLabel(product: ProductForPositioning) {
  const name = product.name.toLowerCase();
  const categoryName = product.category?.name.toLowerCase() ?? "";

  if (product.price < 100000 || categoryName.includes("gifts under")) {
    return "Everyday Gifts";
  }

  if (
    categoryName.includes("personalized") ||
    name.includes("custom") ||
    name.includes("memory") ||
    name.includes("keepsake")
  ) {
    return "Made to Order";
  }

  if (categoryName.includes("home") || name.includes("tray") || name.includes("plate")) {
    return "Statement Decor";
  }

  return "Made to Order";
}

export function warmDisplayCopy(value: string) {
  return value
    .replaceAll("Personalized Keepsakes", "Personalized Pieces")
    .replaceAll("Personal Keepsakes", "Personalized Pieces")
    .replaceAll("Custom Keepsakes", "Custom Gifts")
    .replaceAll("Everyday Keepsake", "Everyday Gift")
    .replaceAll("Keepsake Coasters", "Gift Coasters")
    .replaceAll("Keepsake Frame", "Memory Frame")
    .replaceAll("Devotional Keepsake", "Devotional Gift")
    .replaceAll("Everyday Keepsake", "Everyday Gift")
    .replaceAll("keepsake form", "personalized form")
    .replaceAll("keepsake detail", "personal detail")
    .replaceAll("keepsake", "piece")
    .replaceAll("Keepsake", "Piece")
    .replaceAll("keepsakes", "pieces")
    .replaceAll("Keepsakes", "Pieces");
}
