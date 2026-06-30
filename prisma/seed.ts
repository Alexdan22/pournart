import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const customizationFields = [
  { name: "size", label: "Preferred size", type: "text", placeholder: "Example: 6 inch / 8 inch" },
  { name: "colors", label: "Preferred colors", type: "text", placeholder: "Example: teal, gold, white" },
  { name: "personalization", label: "Name/date/text", type: "text", placeholder: "Add exact text if needed" },
  { name: "notes", label: "Customization notes", type: "textarea", placeholder: "Flowers, shells, finish, theme, gifting date" },
];

const categories = [
  {
    name: "Coasters",
    slug: "coasters",
    description: "Ocean, floral, and festive resin coaster sets for gifting and table styling.",
    imageUrl: "/assets/resin-coasters.png",
    shippingFee: 90,
    sortOrder: 1,
  },
  {
    name: "Name Plates",
    slug: "name-plates",
    description: "Personalized resin name plates with flowers, shells, gold flakes, and custom lettering.",
    imageUrl: "/assets/resin-nameplate.png",
    shippingFee: 140,
    sortOrder: 2,
  },
  {
    name: "Trays",
    slug: "trays",
    description: "Hand-poured resin trays for festive hampers, vanity corners, and premium gifting.",
    imageUrl: "/assets/resin-tray.png",
    shippingFee: 180,
    sortOrder: 3,
  },
  {
    name: "Idols & Keepsakes",
    slug: "idols-keepsakes",
    description: "Devotional resin pieces, memory keepsakes, and luminous handmade display art.",
    imageUrl: "/assets/resin-idol.png",
    shippingFee: 160,
    sortOrder: 4,
  },
  {
    name: "Custom Gifts",
    slug: "custom-gifts",
    description: "Made-to-order resin gifts for weddings, anniversaries, birthdays, and collaborations.",
    imageUrl: "/assets/resin-hero.png",
    shippingFee: 120,
    sortOrder: 5,
  },
  {
    name: "Keychains",
    slug: "keychains",
    description: "Compact personalized resin keychains with initials, charms, and preserved details.",
    imageUrl: "/assets/resin-coasters-blue.png",
    shippingFee: 60,
    sortOrder: 6,
  },
];

const products = [
  {
    categorySlug: "coasters",
    name: "Ocean Bloom Coaster Set",
    slug: "ocean-bloom-coaster-set",
    description: "A set of four glossy ocean resin coasters with shell details and soft gold edging.",
    story: "Inspired by quiet shorelines and airy gifting tables, each piece is hand-poured in small batches.",
    price: 149900,
    compareAtPrice: 179900,
    imageUrl: "/assets/resin-coasters.png",
    inventory: 8,
    isFeatured: true,
    handmadeDaysMin: 5,
    handmadeDaysMax: 8,
  },
  {
    categorySlug: "coasters",
    name: "Sea Glass Accent Coasters",
    slug: "sea-glass-accent-coasters",
    description: "Translucent teal and resin blue coasters with pearl-sand textures.",
    story: "Made for coffee tables, housewarming hampers, and everyday rituals that deserve a little shine.",
    price: 129900,
    imageUrl: "/assets/resin-coasters-blue.png",
    inventory: 12,
    isFeatured: true,
    handmadeDaysMin: 4,
    handmadeDaysMax: 7,
  },
  {
    categorySlug: "name-plates",
    name: "Floral Ocean Name Plate",
    slug: "floral-ocean-name-plate",
    description: "Custom resin name plate with preserved flowers, teal swirls, and gold flake highlights.",
    story: "Designed as a premium first impression for homes, studios, salons, and gifting moments.",
    price: 249900,
    compareAtPrice: 289900,
    imageUrl: "/assets/resin-nameplate.png",
    inventory: 6,
    isFeatured: true,
    handmadeDaysMin: 8,
    handmadeDaysMax: 14,
  },
  {
    categorySlug: "trays",
    name: "Blush Petal Resin Tray",
    slug: "blush-petal-resin-tray",
    description: "Oval resin tray with preserved petals, soft gold flakes, and brass-finish handles.",
    story: "A centerpiece for festive hampers, vanity shelves, and handcrafted wedding gifts.",
    price: 219900,
    imageUrl: "/assets/resin-tray.png",
    inventory: 7,
    isFeatured: true,
    handmadeDaysMin: 7,
    handmadeDaysMax: 12,
  },
  {
    categorySlug: "idols-keepsakes",
    name: "Golden Aura Devotional Keepsake",
    slug: "golden-aura-devotional-keepsake",
    description: "A luminous resin keepsake with warm gold flakes and devotional styling.",
    story: "Created for festive corners and meaningful gifting, with every piece poured and polished by hand.",
    price: 189900,
    imageUrl: "/assets/resin-idol.png",
    inventory: 5,
    isFeatured: true,
    handmadeDaysMin: 6,
    handmadeDaysMax: 10,
  },
  {
    categorySlug: "custom-gifts",
    name: "Memory Resin Frame",
    slug: "memory-resin-frame",
    description: "A custom resin frame for names, dates, florals, shells, or personal keepsake elements.",
    story: "Built around the customer story, from anniversary dates to preserved floral memories.",
    price: 279900,
    imageUrl: "/assets/resin-hero.png",
    inventory: 4,
    handmadeDaysMin: 10,
    handmadeDaysMax: 18,
  },
  {
    categorySlug: "keychains",
    name: "Initial Charm Keychain Pair",
    slug: "initial-charm-keychain-pair",
    description: "Personalized resin keychain pair with initials, color choices, and charm accents.",
    story: "Small, custom, and easy to gift across birthdays, bridesmaid hampers, and return favors.",
    price: 49900,
    imageUrl: "/assets/resin-coasters-blue.png",
    inventory: 20,
    handmadeDaysMin: 3,
    handmadeDaysMax: 6,
  },
  {
    categorySlug: "custom-gifts",
    name: "Custom Wedding Ring Platter",
    slug: "custom-wedding-ring-platter",
    description: "Handmade resin platter for ceremonies, ring exchanges, and personalized wedding styling.",
    story: "A keepsake piece shaped around wedding colors, initials, flowers, and event dates.",
    price: 329900,
    compareAtPrice: 369900,
    imageUrl: "/assets/resin-tray.png",
    inventory: 3,
    handmadeDaysMin: 10,
    handmadeDaysMax: 16,
  },
  {
    categorySlug: "trays",
    name: "Ocean Vanity Tray",
    slug: "ocean-vanity-tray",
    description: "Glossy blue-teal resin tray for candles, perfume, jewelry, and bedside styling.",
    story: "Handmade with layered resin movement so each piece catches light differently.",
    price: 199900,
    imageUrl: "/assets/resin-tray.png",
    inventory: 9,
    handmadeDaysMin: 6,
    handmadeDaysMax: 9,
  },
  {
    categorySlug: "name-plates",
    name: "Gold Leaf Studio Plate",
    slug: "gold-leaf-studio-plate",
    description: "Premium studio or home name plate with custom text and gold leaf detailing.",
    story: "A refined handmade plate for creators, boutiques, clinics, studios, and gifting.",
    price: 269900,
    imageUrl: "/assets/resin-nameplate.png",
    inventory: 5,
    handmadeDaysMin: 8,
    handmadeDaysMax: 14,
  },
  {
    categorySlug: "idols-keepsakes",
    name: "Festive Resin Table Accent",
    slug: "festive-resin-table-accent",
    description: "Warm gold resin decor piece for festive gifting and pooja corners.",
    story: "A serene handmade accent designed to glow softly in premium gift hampers.",
    price: 159900,
    imageUrl: "/assets/resin-idol.png",
    inventory: 6,
    handmadeDaysMin: 5,
    handmadeDaysMax: 9,
  },
  {
    categorySlug: "custom-gifts",
    name: "Collaboration Custom Order",
    slug: "collaboration-custom-order",
    description: "A flexible custom slot for resin art collaborations and special one-off requests.",
    story: "Customers can describe the idea, color palette, timeline, and occasion before final confirmation.",
    price: 99900,
    imageUrl: "/assets/resin-hero.png",
    inventory: 15,
    handmadeDaysMin: 7,
    handmadeDaysMax: 21,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("Admin@12345", 12);

  await prisma.user.upsert({
    where: { email: "admin@pournart.local" },
    update: { role: "ADMIN", passwordHash },
    create: {
      name: "Pour n Art Admin",
      email: "admin@pournart.local",
      phone: "9999999999",
      passwordHash,
      role: "ADMIN",
    },
  });

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  const categoryMap = await prisma.category.findMany();
  const categoryIdBySlug = new Map(categoryMap.map((category) => [category.slug, category.id]));

  for (const product of products) {
    const categoryId = categoryIdBySlug.get(product.categorySlug);

    if (!categoryId) {
      throw new Error(`Missing category for ${product.categorySlug}`);
    }

    const productData = {
      name: product.name,
      slug: product.slug,
      description: product.description,
      story: product.story,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      imageUrl: product.imageUrl,
      inventory: product.inventory,
      isFeatured: product.isFeatured,
      handmadeDaysMin: product.handmadeDaysMin,
      handmadeDaysMax: product.handmadeDaysMax,
    };
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        ...productData,
        categoryId,
        customizationFields: JSON.stringify(customizationFields),
      },
      create: {
        ...productData,
        categoryId,
        customizationFields: JSON.stringify(customizationFields),
      },
    });
  }

  await prisma.coupon.upsert({
    where: { code: "HANDMADE10" },
    update: {},
    create: {
      code: "HANDMADE10",
      description: "Launch offer for early Pour n Art customers",
      type: "PERCENT",
      value: 10,
      minSubtotal: 199900,
    },
  });

  await prisma.banner.upsert({
    where: { id: "home-hero" },
    update: {},
    create: {
      id: "home-hero",
      title: "Custom resin art, hand-poured for gifting moments",
      subtitle: "Premium coasters, name plates, trays, devotional keepsakes, and one-off custom orders made across India.",
      ctaLabel: "Explore the collection",
      ctaHref: "/products",
      imageUrl: "/assets/resin-hero.png",
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
