// MenuKey is a union type, meaning it can only be one of the specified string values
// add | "Blog" if required
export type MenuKey = "About" | "Programmes" | "Classes" | "Contact";

// interface: Primarily used to define the shape of an object (like a class or an object literal). It’s best when you want to describe the structure of an object that has properties and methods.
export interface Section {
  mainTitle?: string;
  title?: string;
  items: string[];
  sections?: Section[]; // Allows subsections
}

// The Record utility type is a built-in TypeScript type that allows you to define an object type with a specific set of keys and values.
export const dropdownData: Record<MenuKey, { sections: Section[] }> = {
  About: {
    sections: [
      {
        // inner subsection
        mainTitle: "About",
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
  Programmes: {
    sections: [
      {
        mainTitle: "Programmes",
        items: [
          "Explore Mac",
          "MacBook Air",
          "MacBook Pro",
          "iMac",
          "Mac Studio",
          "Displays",
        ],
      },
      {
        title: "Shop Mac",
        items: [
          "Find a Store",
          "Order Status",
          "Apple Trade In",
          "Financing",
          "University Student Offer",
        ],
      },
      {
        title: "More from Mac",
        items: ["Certified Refurbish", "Education", "Business"],
      },
    ],
  },
  Classes: {
    sections: [
      {
        mainTitle: "Classes",
        items: [
          "Explore iPad",
          "iPad Air",
          "iPad Pro",
          "iPad",
          "iPad Mini",
          "Apple Pencil",
          "Keyboard",
        ],
      },
      {
        title: "Shop iPad",
        items: [
          "Find a Store",
          "Order Status",
          "Apple Trade In",
          "Financing",
          "University Student Offer",
        ],
      },
      {
        title: "More from iPad",
        items: ["Certified Refurbish", "Education", "Business"],
      },
    ],
  },
  // Blog: {
  //   sections: [
  //     {
  //       mainTitle: "Blog",
  //       items: [
  //         "Explore Apple Watch",
  //         "Apple Watch Series 9",
  //         "Apple Watch Ultra 2",
  //         "Apple Watch SE",
  //         "Apple Watch Nike",
  //         "Apple Watch Hermes",
  //       ],
  //     },
  //     {
  //       title: "Shop Watch",
  //       items: [
  //         "Find a Store",
  //         "Order Status",
  //         "Apple Trade In",
  //         "Financing",
  //         "University Student Offer",
  //       ],
  //     },
  //     {
  //       title: "More from Watch",
  //       items: ["Certified Refurbish", "Education", "Business"],
  //     },
  //   ],
  // },
  Contact: {
    sections: [
      {
        mainTitle: "Contact",
        items: [
          "Explore AirPods",
          "AirPods Pro",
          "AirPods (2nd gen)",
          "AirPods (3rd gen)",
          "AirPods Max",
        ],
      },
      {
        title: "Shop AirPods",
        items: [
          "Find a Store",
          "Order Status",
          "Apple Trade In",
          "Financing",
          "University Student Offer",
        ],
      },
      {
        title: "More from AirPods",
        items: ["Certified Refurbish", "Education", "Business"],
      },
    ],
  },
};
