// MenuKey is a union type, meaning it can only be one of the specified string values
// add | "Blog" if required
export type MenuKey = "GenerateMC";

// interface: Primarily used to define the shape of an object (like a class or an object literal). It’s best when you want to describe the structure of an object that has properties and methods.
export interface Section {
  mainTitle?: string;
  title?: string;
  items: string[];
  sections?: Section[]; // Allows subsections
}

// The Record utility type is a built-in TypeScript type that allows you to define an object type with a specific set of keys and values.
export const dropdownData: Record<MenuKey, { sections: Section[] }> = {
  GenerateMC: {
    sections: [
      {
        // inner subsection
        mainTitle: "Generate MC",
        items: [
          "Shop the Latest",
          "Mac",
          "iPad",
          "iPhone",
          "Apple Watch",
          "Accessories",
        ],
      },
      {
        title: "Quick Links",
        items: [
          "Find a Store",
          "Order Status",
          "Apple Trade In",
          "Financing",
          "University Student Offer",
        ],
      },
      {
        title: "Shop Special Stores",
        items: ["Certified Refurbish", "Education", "Business"],
      },
    ],
  },
};
