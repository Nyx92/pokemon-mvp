import { atom } from "recoil";
import { Section } from "../shared-components/navbar/DropdownStoreData"; // Adjust the import path

// TypeScript type annotations
export const anchorElNavState = atom<boolean>({
  key: "anchorElNavState", // unique ID (with respect to other atoms/selectors)
  default: false, // default value (aka initial value)
});

export const anchorElMenuNavState = atom<boolean>({
  key: "anchorElMenuNavState", // unique ID (with respect to other atoms/selectors)
  default: false, // default value (aka initial value)
});

type DropdownSectionType = Section | null;

export const selectedDropdownSectionState = atom<DropdownSectionType>({
  key: "selectedDropdownSectionState",
  default: null, // No section selected by default
});
