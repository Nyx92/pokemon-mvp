import { create } from "zustand";
import { Section } from "../shared-components/navbar/DropdownStoreData";

type DropdownSectionType = Section | null;

interface NavbarState {
  anchorElNavOpen: boolean;
  anchorElMenuNavOpen: boolean;
  selectedDropdownSection: DropdownSectionType;

  // actions
  setAnchorElNavOpen: (value: boolean) => void;
  setAnchorElMenuNavOpen: (value: boolean) => void;
  setSelectedDropdownSection: (section: DropdownSectionType) => void;
  reset: () => void;
}

export const useNavbarStore = create<NavbarState>((set) => ({
  anchorElNavOpen: false,
  anchorElMenuNavOpen: false,
  selectedDropdownSection: null,

  setAnchorElNavOpen: (value) => set({ anchorElNavOpen: value }),
  setAnchorElMenuNavOpen: (value) => set({ anchorElMenuNavOpen: value }),
  setSelectedDropdownSection: (section) =>
    set({ selectedDropdownSection: section }),
  reset: () =>
    set({
      anchorElNavOpen: false,
      anchorElMenuNavOpen: false,
      selectedDropdownSection: null,
    }),
}));
