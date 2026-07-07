import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export type BusinessAction = {
  label: string;
  href: string;
  external?: boolean;
};

export type FAQItem = {
  question: string;
  answer: string;
};

export type FAQCategory = {
  title: string;
  description: string;
  items: FAQItem[];
};

export type PolicyContent = {
  metadata: Metadata;
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  sections: {
    title: string;
    intro: string;
    items: string[];
  }[];
};

export const businessMetadata = {
  about: {
    ...createMetadata({
      title: "About Pour n Art",
      description: "Meet Pour n Art, a boutique studio creating handcrafted custom gifts and keepsake resin pieces.",
      path: "/about",
      image: "/assets/optimized/resin-hero-home.webp",
    }),
  },
  contact: {
    ...createMetadata({
      title: "Contact Pour n Art",
      description: "Start a custom Pour n Art gift request or reach the studio by email, WhatsApp, or Instagram.",
      path: "/contact",
      image: "/assets/optimized/personal-keepsakes-home.webp",
    }),
  },
  faq: {
    ...createMetadata({
      title: "FAQ",
      description: "Helpful answers about Pour n Art orders, custom pieces, shipping, returns, and product care.",
      path: "/faq",
      image: "/assets/optimized/resin-coasters-blue-home.webp",
    }),
  },
} satisfies Record<string, Metadata>;

export const aboutStoryBlocks = [
  {
    eyebrow: "Our Story",
    title: "Small-batch pieces with a personal hand.",
    description:
      "Pour n Art began as a quiet studio for preserving colors, names, flowers, and little memories in useful handcrafted pieces.",
  },
  {
    eyebrow: "Our Philosophy",
    title: "Thoughtful over mass-made.",
    description:
      "Every piece is shaped slowly, with room for natural variation, gentle detail, and the feeling of a gift chosen with care.",
  },
  {
    eyebrow: "How We Create",
    title: "Poured, cured, finished, and packed by hand.",
    description:
      "We confirm the idea, arrange the details, pour in careful layers, finish the edges, and pack each order for gifting.",
  },
];

export const creationSteps = [
  {
    title: "Share the story",
    description: "Names, dates, colors, florals, shells, or a simple mood are gathered first.",
  },
  {
    title: "Shape the design",
    description: "The product, timeline, and key details are confirmed before studio work begins.",
  },
  {
    title: "Handcraft slowly",
    description: "Each piece is poured, cured, finished, checked, and packed with protective care.",
  },
];

export const whyChoosePoints = [
  {
    title: "Made to feel personal",
    description: "Concise custom details make each gift feel close to the person receiving it.",
  },
  {
    title: "Boutique finish",
    description: "Clean edges, soft shine, and gift-ready packing keep the experience polished.",
  },
  {
    title: "One-of-one character",
    description: "Small handmade variations make every pour naturally unique.",
  },
  {
    title: "Warm studio guidance",
    description: "The team helps shape the idea before the piece is made.",
  },
];

export const businessHours = [
  { label: "Studio replies", value: "Mon-Sat, 10 AM-6 PM" },
  { label: "Custom order review", value: "Within 1 business day" },
  { label: "Holiday notes", value: "Shared during peak gifting weeks" },
];

export const faqCategories: FAQCategory[] = [
  {
    title: "Ordering",
    description: "Before you place an order.",
    items: [
      {
        question: "How do I place an order?",
        answer: "Choose a product, add any details requested, and complete checkout. For a custom idea, use the contact form.",
      },
      {
        question: "Can I order a gift directly for someone else?",
        answer: "Yes. Add the recipient address at checkout and mention any simple gifting note in the order details.",
      },
      {
        question: "Will I get an order update?",
        answer: "Yes. Order and crafting updates are shared as the piece moves through the studio.",
      },
    ],
  },
  {
    title: "Custom Orders",
    description: "Personalized keepsakes and made-to-order pieces.",
    items: [
      {
        question: "What details can I customize?",
        answer: "Names, initials, dates, colors, flowers, shells, and small story details can be discussed before making.",
      },
      {
        question: "Can I share a reference image?",
        answer: "Yes. The custom request form accepts a reference image so the studio can understand the mood.",
      },
      {
        question: "Are custom designs exactly repeatable?",
        answer: "No handmade pour is identical, but the studio will follow the agreed color story and placement direction.",
      },
    ],
  },
  {
    title: "Shipping",
    description: "Dispatch and delivery basics.",
    items: [
      {
        question: "When will my order ship?",
        answer: "Most items ship after their making and curing time. Tracking is shared after dispatch.",
      },
      {
        question: "Do you pack fragile pieces safely?",
        answer: "Yes. Each order is wrapped with protective packing suited to the product shape.",
      },
      {
        question: "Can delivery dates be guaranteed?",
        answer: "Dates are estimated. Peak weeks, weather, or courier delays may affect delivery.",
      },
    ],
  },
  {
    title: "Returns",
    description: "What happens if something is not right.",
    items: [
      {
        question: "Can handmade pieces be returned?",
        answer: "Returns depend on the product type and condition. Custom pieces may not be eligible unless damaged.",
      },
      {
        question: "What if my order arrives damaged?",
        answer: "Share clear photos soon after delivery so the studio can review the issue and next step.",
      },
      {
        question: "How long do refunds take?",
        answer: "Approved refunds are processed after review. Bank or payment timelines may vary.",
      },
    ],
  },
  {
    title: "Product Care",
    description: "Keeping your piece beautiful.",
    items: [
      {
        question: "How should I clean resin pieces?",
        answer: "Use a soft damp cloth. Avoid harsh scrubbing, abrasive cleaners, or soaking.",
      },
      {
        question: "Can I keep the piece in direct sun?",
        answer: "Avoid prolonged direct sunlight or high heat to help preserve the finish.",
      },
      {
        question: "Are small bubbles normal?",
        answer: "Yes. Gentle handmade variation is natural and part of the character of each piece.",
      },
    ],
  },
];

export const policyPages = {
  shipping: {
    metadata: {
      ...createMetadata({
        title: "Shipping Policy",
        description: "Placeholder shipping policy for Pour n Art handcrafted custom gifts.",
        path: "/shipping-policy",
        image: "/assets/optimized/resin-tray-home.webp",
      }),
    },
    eyebrow: "Shipping Policy",
    title: "Shipping, made clear and careful.",
    description: "A concise guide to how handcrafted pieces move from our studio to your home.",
    imageSrc: "/assets/optimized/resin-tray-home.webp",
    sections: [
      {
        title: "Processing Time",
        intro: "Orders are reviewed before studio work begins.",
        items: ["Order details are checked after payment.", "Custom notes may be confirmed by message.", "Peak gifting weeks may need extra time."],
      },
      {
        title: "Production Timeline",
        intro: "Handmade pieces need time to cure and finish.",
        items: ["Ready pieces may dispatch sooner.", "Custom work follows the confirmed timeline.", "Curing time is part of the making process."],
      },
      {
        title: "Shipping Partners",
        intro: "Courier partners are chosen based on serviceability.",
        items: ["Partner choice may vary by pincode.", "Fragile pieces are packed with extra care.", "Courier delays may be outside studio control."],
      },
      {
        title: "Tracking",
        intro: "Tracking is shared after dispatch.",
        items: ["Tracking links may take time to activate.", "Delivery updates come from the courier.", "Support is available for delayed scans."],
      },
      {
        title: "Delivery Information",
        intro: "Please keep delivery details accurate.",
        items: ["Incorrect addresses may delay delivery.", "Someone may need to receive fragile parcels.", "Delivery estimates are not guarantees."],
      },
    ],
  },
  returnRefund: {
    metadata: {
      ...createMetadata({
        title: "Return & Refund Policy",
        description: "Placeholder return and refund policy for Pour n Art handmade and custom pieces.",
        path: "/return-refund-policy",
        image: "/assets/optimized/resin-coasters-card.webp",
      }),
    },
    eyebrow: "Return & Refund Policy",
    title: "Support for orders that need a second look.",
    description: "A simple placeholder guide for eligibility, damage review, and refund timelines.",
    imageSrc: "/assets/optimized/resin-coasters-card.webp",
    sections: [
      {
        title: "Eligibility",
        intro: "Eligibility depends on the product and condition.",
        items: ["Unused ready-made items may be reviewed.", "Original packaging may be requested.", "Custom pieces follow separate rules."],
      },
      {
        title: "Damaged Orders",
        intro: "Damage is reviewed with clear delivery evidence.",
        items: ["Share photos of the product and packaging.", "Contact support soon after delivery.", "Keep the parcel until review is complete."],
      },
      {
        title: "Custom Orders",
        intro: "Personalized pieces are made specifically for you.",
        items: ["Custom orders may not be returnable.", "Approved issues are handled case by case.", "Design details should be confirmed before making."],
      },
      {
        title: "Refund Timeline",
        intro: "Approved refunds follow payment partner timelines.",
        items: ["The studio confirms once refund processing starts.", "Bank timelines may vary.", "Shipping fees may be reviewed separately."],
      },
      {
        title: "Contact Support",
        intro: "Support starts with order details.",
        items: ["Share your order number.", "Attach photos when relevant.", "Use email or WhatsApp for the fastest review."],
      },
    ],
  },
  privacy: {
    metadata: {
      ...createMetadata({
        title: "Privacy Policy",
        description: "Placeholder privacy policy for Pour n Art customer and order information.",
        path: "/privacy-policy",
        image: "/assets/optimized/personal-keepsakes-home.webp",
      }),
    },
    eyebrow: "Privacy Policy",
    title: "Your details are handled with care.",
    description: "A concise placeholder explaining how basic order and contact information is used.",
    imageSrc: "/assets/optimized/personal-keepsakes-home.webp",
    sections: [
      {
        title: "Information Collection",
        intro: "We collect only what helps complete your order.",
        items: ["Contact details support order updates.", "Shipping details help delivery.", "Custom notes help make your piece."],
      },
      {
        title: "Payments",
        intro: "Payments are handled through secure payment partners.",
        items: ["Card details are not stored by the studio.", "Payment status is used to confirm orders.", "Receipts may be sent by email."],
      },
      {
        title: "Cookies",
        intro: "Basic cookies may support site function.",
        items: ["Cookies may keep carts working.", "Analytics may help improve the website.", "Browser settings can manage cookies."],
      },
      {
        title: "Data Usage",
        intro: "Information is used for service and support.",
        items: ["We use details to make and deliver orders.", "Messages may support custom requests.", "We do not sell customer information."],
      },
      {
        title: "Security",
        intro: "Reasonable care is used for stored information.",
        items: ["Access is limited to order support needs.", "Admin tools are protected.", "No method is perfectly risk-free."],
      },
      {
        title: "Contact",
        intro: "Privacy questions can be sent to the studio.",
        items: ["Email support with your request.", "Include order details if relevant.", "We will review and respond clearly."],
      },
    ],
  },
  terms: {
    metadata: {
      ...createMetadata({
        title: "Terms & Conditions",
        description: "Placeholder terms and conditions for Pour n Art website orders and custom gifts.",
        path: "/terms-and-conditions",
        image: "/assets/optimized/resin-idol-home.webp",
      }),
    },
    eyebrow: "Terms & Conditions",
    title: "A simple guide to using the studio shop.",
    description: "Placeholder terms for orders, pricing, creative work, and support expectations.",
    imageSrc: "/assets/optimized/resin-idol-home.webp",
    sections: [
      {
        title: "Orders",
        intro: "Orders begin after checkout or custom confirmation.",
        items: ["Order details should be accurate.", "Custom notes may require confirmation.", "The studio may contact you for missing details."],
      },
      {
        title: "Pricing",
        intro: "Prices reflect product size, detail, and material.",
        items: ["Prices may change without prior notice.", "Custom quotes are confirmed before making.", "Shipping and taxes may appear separately."],
      },
      {
        title: "Intellectual Property",
        intro: "Studio designs and images remain protected.",
        items: ["Do not reuse site images without permission.", "Custom references are used only for your request.", "Handmade designs may inspire future collections."],
      },
      {
        title: "Liability",
        intro: "Care guidance helps protect handmade pieces.",
        items: ["Use products as intended.", "Avoid heat, harsh cleaners, and rough handling.", "Delivery delays may be outside studio control."],
      },
      {
        title: "Governing Law",
        intro: "These placeholder terms follow local business needs.",
        items: ["Final legal terms should be reviewed before launch.", "Disputes should first be raised with support.", "Applicable law may depend on business registration."],
      },
      {
        title: "Contact",
        intro: "Questions can be sent before ordering.",
        items: ["Use email or WhatsApp.", "Include order details when available.", "The studio will help clarify next steps."],
      },
    ],
  },
} satisfies Record<string, PolicyContent>;
