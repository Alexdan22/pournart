import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const customizationFields = [
  { name: "size", label: "Preferred size", type: "text", placeholder: "Example: 6 inch / 8 inch" },
  { name: "colors", label: "Color story", type: "text", placeholder: "Example: teal, gold, ivory" },
  { name: "personalization", label: "Names, dates, or initials", type: "text", placeholder: "Add exact text if needed" },
  {
    name: "notes",
    label: "Keepsake notes",
    type: "textarea",
    placeholder: "Flowers, shells, memory, finish, theme, gifting date",
  },
];

const retiredCategorySlugs = ["coasters", "name-plates", "trays", "idols-keepsakes", "custom-gifts", "keychains"];

const categories = [
  {
    name: "Gifts Under ₹1000",
    slug: "gifts-under-1000",
    description: "Small personalized keepsakes and thoughtful everyday gifts made for easy gifting.",
    imageUrl: "/assets/resin-coasters-blue.png",
    shippingFee: 60,
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "Home Collection",
    slug: "home-collection",
    description: "Statement decor for entrances, vanity corners, festive tables, and new homes.",
    imageUrl: "/assets/resin-tray.png",
    shippingFee: 180,
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "Wearables",
    slug: "wearables",
    description: "Personalized everyday keepsakes made to carry initials, colors, and tiny memories.",
    imageUrl: "/assets/resin-coasters-blue.png",
    shippingFee: 60,
    isActive: true,
    sortOrder: 3,
  },
  {
    name: "Botanical Collection",
    slug: "botanical-collection",
    description: "Preserved florals, petal details, and soft nature-led pieces for meaningful gifting.",
    imageUrl: "/assets/resin-nameplate.png",
    shippingFee: 140,
    isActive: true,
    sortOrder: 4,
  },
  {
    name: "Ocean Collection",
    slug: "ocean-collection",
    description: "Ocean-inspired gifts with shell details, sea-glass colors, and coastal calm.",
    imageUrl: "/assets/resin-coasters.png",
    shippingFee: 90,
    isActive: true,
    sortOrder: 5,
  },
  {
    name: "Personalized Keepsakes",
    slug: "personalized-keepsakes",
    description: "Names, dates, initials, and memories turned into made-to-order pieces.",
    imageUrl: "/assets/resin-hero.png",
    shippingFee: 120,
    isActive: true,
    sortOrder: 6,
  },
];

const products = [
  {
    categorySlug: "ocean-collection",
    name: "Ocean-Inspired Gift Coaster Set",
    slug: "ocean-bloom-coaster-set",
    description: "A set of four ocean-inspired gift coasters with shell details and soft gold edging.",
    story:
      "Made for birthday gifts, housewarming hampers, and coffee tables that deserve a memory of the shoreline.",
    price: 149900,
    compareAtPrice: 179900,
    imageUrl: "/assets/resin-coasters.png",
    inventory: 8,
    isFeatured: true,
    handmadeDaysMin: 5,
    handmadeDaysMax: 8,
  },
  {
    categorySlug: "ocean-collection",
    name: "Sea Glass Keepsake Coasters",
    slug: "sea-glass-accent-coasters",
    description: "Translucent teal coasters with pearl-sand textures, made as thoughtful everyday gifts.",
    story:
      "A coastal keepsake for quiet rituals, return gifts, and housewarming tables with a soft ocean mood.",
    price: 129900,
    imageUrl: "/assets/resin-coasters-blue.png",
    inventory: 12,
    isFeatured: true,
    handmadeDaysMin: 4,
    handmadeDaysMax: 7,
  },
  {
    categorySlug: "botanical-collection",
    name: "Botanical Welcome Name Plate",
    slug: "floral-ocean-name-plate",
    description: "A personalized welcome piece with preserved flowers, teal movement, and gold highlights.",
    story:
      "Designed as a premium first impression for homes, studios, salons, and housewarming gifts.",
    price: 249900,
    compareAtPrice: 289900,
    imageUrl: "/assets/resin-nameplate.png",
    inventory: 6,
    isFeatured: true,
    handmadeDaysMin: 8,
    handmadeDaysMax: 14,
  },
  {
    categorySlug: "botanical-collection",
    name: "Blush Petal Memory Tray",
    slug: "blush-petal-resin-tray",
    description: "An oval memory tray with preserved petals, soft gold flakes, and brass-finish handles.",
    story:
      "A graceful keepsake for anniversary gifts, bridal hampers, vanity shelves, and festive hosting.",
    price: 219900,
    imageUrl: "/assets/resin-tray.png",
    inventory: 7,
    isFeatured: true,
    handmadeDaysMin: 7,
    handmadeDaysMax: 12,
  },
  {
    categorySlug: "home-collection",
    name: "Golden Aura Devotional Keepsake",
    slug: "golden-aura-devotional-keepsake",
    description: "A luminous devotional keepsake with warm gold detail and gift-ready presence.",
    story:
      "Created for festive corners, pooja shelves, and meaningful gifts that hold warmth beyond the occasion.",
    price: 189900,
    imageUrl: "/assets/resin-idol.png",
    inventory: 5,
    isFeatured: true,
    handmadeDaysMin: 6,
    handmadeDaysMax: 10,
  },
  {
    categorySlug: "personalized-keepsakes",
    name: "Memory Keepsake Frame",
    slug: "memory-resin-frame",
    description: "A custom frame for names, dates, florals, shells, or a personal keepsake detail.",
    story:
      "Built around the customer story, from anniversary dates and wedding flowers to preserved travel memories.",
    price: 279900,
    imageUrl: "/assets/resin-hero.png",
    inventory: 4,
    isFeatured: true,
    handmadeDaysMin: 10,
    handmadeDaysMax: 18,
  },
  {
    categorySlug: "wearables",
    name: "Initial Charm Everyday Keepsake",
    slug: "initial-charm-keychain-pair",
    description: "A personalized pair for initials, color choices, and tiny charm accents.",
    story:
      "Small, custom, and easy to gift across birthdays, bridesmaid hampers, return favors, and everyday memories.",
    price: 49900,
    imageUrl: "/assets/resin-coasters-blue.png",
    inventory: 20,
    isFeatured: true,
    handmadeDaysMin: 3,
    handmadeDaysMax: 6,
  },
  {
    categorySlug: "personalized-keepsakes",
    name: "Custom Wedding Ring Platter",
    slug: "custom-wedding-ring-platter",
    description: "A handcrafted platter for ceremonies, ring exchanges, initials, and wedding dates.",
    story:
      "A made-to-order wedding keepsake shaped around event colors, flowers, initials, and the date.",
    price: 329900,
    compareAtPrice: 369900,
    imageUrl: "/assets/resin-tray.png",
    inventory: 3,
    isFeatured: true,
    handmadeDaysMin: 10,
    handmadeDaysMax: 16,
  },
  {
    categorySlug: "ocean-collection",
    name: "Ocean-Inspired Vanity Tray",
    slug: "ocean-vanity-tray",
    description: "A glossy blue-teal statement tray for candles, perfume, jewelry, and bedside styling.",
    story:
      "Handmade with layered coastal movement so each statement decor piece catches light differently.",
    price: 199900,
    imageUrl: "/assets/resin-tray.png",
    inventory: 9,
    handmadeDaysMin: 6,
    handmadeDaysMax: 9,
  },
  {
    categorySlug: "home-collection",
    name: "Gold Leaf Studio Name Plate",
    slug: "gold-leaf-studio-plate",
    description: "A premium studio or home name plate with custom text and gold leaf detailing.",
    story:
      "A refined handmade piece for creators, boutiques, clinics, studios, and thoughtful housewarming gifts.",
    price: 269900,
    imageUrl: "/assets/resin-nameplate.png",
    inventory: 5,
    handmadeDaysMin: 8,
    handmadeDaysMax: 14,
  },
  {
    categorySlug: "home-collection",
    name: "Festive Table Keepsake",
    slug: "festive-resin-table-accent",
    description: "A warm gold table accent for festive gifting, pooja corners, and home styling.",
    story:
      "A serene handmade accent designed to glow softly in premium gift hampers and celebration corners.",
    price: 159900,
    imageUrl: "/assets/resin-idol.png",
    inventory: 6,
    handmadeDaysMin: 5,
    handmadeDaysMax: 9,
  },
  {
    categorySlug: "gifts-under-1000",
    name: "Everyday Gift Custom Slot",
    slug: "collaboration-custom-order",
    description: "A flexible starter slot for small made-to-order gifts, initials, colors, and simple details.",
    story:
      "Customers can describe the idea, palette, timeline, and occasion before the final custom piece is confirmed.",
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

  await prisma.category.updateMany({
    where: { slug: { in: retiredCategorySlugs } },
    data: { isActive: false },
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
    update: {
      title: "Handcrafted gifts that become lifelong keepsakes.",
      subtitle:
        "Personalized resin keepsakes, statement decor, and thoughtful gifts inspired by memories, nature, and the ocean.",
      ctaLabel: "Explore Collections",
      ctaHref: "/products",
      imageUrl: "/assets/resin-hero.png",
      isActive: true,
    },
    create: {
      id: "home-hero",
      title: "Handcrafted gifts that become lifelong keepsakes.",
      subtitle:
        "Personalized resin keepsakes, statement decor, and thoughtful gifts inspired by memories, nature, and the ocean.",
      ctaLabel: "Explore Collections",
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
