"use client";

import { useState, useEffect } from "react";
import { Button, Typography, Box, Grid, SxProps, Theme } from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { dropdownData, Section, MenuKey } from "./DropdownStoreData";
import { useNavbarStore } from "../../store/navbarStore";
import "./Navbar.css";

// Define the props interface
interface DropdownStoreNavMenuProps {
  sx?: SxProps<Theme>;
}

export default function DropdownStoreNavMenu({
  sx,
}: DropdownStoreNavMenuProps) {
  // ✅ Zustand global states + actions
  const {
    anchorElMenuNavOpen: anchorElMenuNav,
    selectedDropdownSection,
    setSelectedDropdownSection,
    setAnchorElMenuNavOpen,
  } = useNavbarStore();

  // ✅ Local UI-only state
  const [menuButtonOffset, setMenuButtonOffset] = useState<number>(0);

  // Whenever dropdown closes, clear selected section
  useEffect(() => {
    if (!anchorElMenuNav) {
      setSelectedDropdownSection(null);
    }
  }, [anchorElMenuNav, setSelectedDropdownSection]);

  // Calculate offset between right edge and hamburger menu for arrow alignment
  useEffect(() => {
    const calculateMenuButtonOffset = () => {
      const menuButton = document.querySelector(
        '[aria-label="menu"]'
      ) as HTMLElement;
      if (menuButton) {
        const offset =
          window.innerWidth - menuButton.getBoundingClientRect().right;
        setMenuButtonOffset(offset);
      }
    };

    calculateMenuButtonOffset();
    window.addEventListener("resize", calculateMenuButtonOffset);
    return () =>
      window.removeEventListener("resize", calculateMenuButtonOffset);
  }, []);

  const handleNavbarItemClick = (section: Section) => {
    setSelectedDropdownSection(section);
  };

  // Renders all top-level menu buttons
  const renderNavbarItems = () =>
    Object.keys(dropdownData).map((navbarItem, index) => (
      <Grid
        key={index}
        onClick={() =>
          handleNavbarItemClick(dropdownData[navbarItem as MenuKey].sections[0])
        }
        sx={{
          flexBasis: {
            xs: "100%",
            sm: "50%",
            md: "25%",
          },
          "&:hover .arrow": {
            opacity: 1,
          },
        }}
      >
        <Typography
          sx={{
            color: "white",
            padding: "8px 16px",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {navbarItem}
          <Box
            className="arrow"
            sx={{
              opacity: 0,
              transition: "opacity 0.3s",
              marginRight: `${menuButtonOffset}px`,
              color: "white",
            }}
          >
            <ArrowForwardIosIcon />
          </Box>
        </Typography>
      </Grid>
    ));

  // Renders a section and its items
  const renderSection = (section: Section) => (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      {section.sections?.map((subSection: Section, subIndex: number) => {
        const isFirstSection = subIndex === 0;

        if (!isFirstSection) {
          return (
            subIndex === 1 && (
              <Box
                key="side-by-side-sections"
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  width: "100%",
                  mb: 2,
                }}
              >
                {section.sections
                  ?.slice(1)
                  .map((innerSubSection, innerIndex) => (
                    <Box
                      key={`inner-section-${innerIndex}`}
                      sx={{
                        width: { xs: "50%", sm: "40%" },
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        mb: 3,
                      }}
                    >
                      <Box sx={{ mb: 3 }}>
                        <Typography
                          sx={{
                            color: "lightgray",
                            fontWeight: "0",
                            fontSize: { xs: "0.9em", sm: "1.2em" },
                            fontFamily:
                              "SF Pro Display,SF Pro Icons,Helvetica Neue,Helvetica,Arial,sans-serif",
                          }}
                        >
                          {innerSubSection.title}
                        </Typography>
                      </Box>
                      {renderSectionItems(innerSubSection)}
                    </Box>
                  ))}
              </Box>
            )
          );
        }

        return (
          <Box
            key={subIndex}
            sx={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              mb: 6,
            }}
          >
            {renderSectionItems(subSection, isFirstSection)}
          </Box>
        );
      })}
    </Box>
  );

  const renderSectionItems = (subSection: Section, isFirstSection?: boolean) =>
    subSection.items.map((item, itemIndex) => (
      <Box
        key={itemIndex}
        sx={{
          display: "flex",
          flexDirection: "column",
          mb: 0.5,
        }}
      >
        <Button
          sx={{
            color: "white",
            textTransform: "capitalize",
            fontSize: isFirstSection
              ? { xs: "1rem", sm: "1.5rem" }
              : { xs: ".8rem", sm: "1rem" },
            fontFamily:
              "SF Pro Display,SF Pro Icons,Helvetica Neue,Helvetica,Arial,sans-serif",
            textAlign: "left",
            justifyContent: "flex-start",
            width: "100%",
          }}
        >
          {item}
        </Button>
      </Box>
    ));

  return (
    <Box sx={{ ...sx }}>
      {selectedDropdownSection ? (
        <Box>
          <Grid container spacing={1}>
            {renderSection(selectedDropdownSection)}
          </Grid>
        </Box>
      ) : (
        <Grid container>{renderNavbarItems()}</Grid>
      )}
    </Box>
  );
}
