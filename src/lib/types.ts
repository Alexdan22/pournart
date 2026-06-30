export type CustomizationField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  categoryName: string;
  handmadeDaysMin: number;
  handmadeDaysMax: number;
  customization: Record<string, string>;
};

export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
