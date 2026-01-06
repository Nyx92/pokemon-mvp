"use client";

import { Box, Theme } from "@mui/material";
import DropdownStoreNav from "./DropdownStoreNav";
import DropdownStoreNavMenu from "./DropdownStoreNavMenu";
import { MenuKey } from "./DropdownStoreData";

type Props =
  | {
      variant: "desktop";
      open: boolean;
      top: number | string;
      animation: string;
      onMouseLeave: () => void;
      devIconOffset: number;
      currentMenu: MenuKey | "";
    }
  | {
      variant: "mobile";
      open: boolean;
      top: number | string;
      animation: string;
      onMouseLeave: () => void;
      devIconOffset: number;
    };

export default function NavbarDropdown(props: Props) {
  const baseSx = {
    position: "fixed" as const,
    top: props.top,
    left: 0,
    width: "100vw",
    zIndex: 1300,
    boxShadow: "0px 3px 10px rgba(0,0,0,0.1)",
    animation: props.animation,
    overflow: "hidden",
    backgroundColor: "black",
    display: "flex",
  };

  if (!props.open) return null;

  if (props.variant === "desktop") {
    return (
      <Box
        sx={{
          ...baseSx,
          flexDirection: "row",
          maxHeight: props.open ? "550px" : "0",
          height: { md: 380, lg: 420, xl: 550 },
        }}
        onMouseLeave={props.onMouseLeave}
      >
        <Box sx={{ width: "100%" }}>
          <DropdownStoreNav
            sx={{
              marginLeft: `${props.devIconOffset}px`,
              marginTop: (theme: Theme) => theme.spacing(4),
              color: "white",
            }}
            currentMenu={props.currentMenu}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        ...baseSx,
        height: "100%",
      }}
      onMouseLeave={props.onMouseLeave}
    >
      <Box sx={{ width: "100%" }}>
        <DropdownStoreNavMenu
          sx={{
            marginLeft: `${props.devIconOffset}px`,
            marginTop: (theme: Theme) => theme.spacing(4),
            color: "white",
          }}
        />
      </Box>
    </Box>
  );
}
