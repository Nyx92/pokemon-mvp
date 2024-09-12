"use client"; // Add this line at the top

import { useState, useEffect } from "react";
import { Button, Typography, Box, Grid2, SxProps, Theme } from "@mui/material";
import { useRecoilState } from "recoil";
import {
  anchorElMenuNavState,
  selectedDropdownSectionState,
} from "../../atoms/navbarState";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"; // For arrow indicators
import { dropdownData, Section, MenuKey } from "./DropdownStoreData"; // Import Section interface for type
import "./Navbar.css";

// Define the props interface
interface DropdownStoreNavMenuProps {
  sx?: SxProps<Theme>;
}

// Component definition
export default function DropdownStoreNavMenu({
  sx,
}: DropdownStoreNavMenuProps) {
  // remembers which section was selected
  const [selectedSection, setSelectedSection] = useRecoilState<Section | null>(
    selectedDropdownSectionState
  );

  // to store the value to align menu buttons with logo
  const [menuButtonOffset, setMenuButtonOffset] = useState<number>(0);

  const [anchorElMenuNav, setAnchorElMenuNav] =
    useRecoilState(anchorElMenuNavState);

  // this useEffect is to forget the selectedSection, whenever the dropdown is closed
  useEffect(() => {
    if (!anchorElMenuNav) {
      setSelectedSection(null);
    }
  }, [anchorElMenuNav, setSelectedSection]);

  // This useEffect hook is used to calculate the offset required to align the arrow icons
  useEffect(() => {
    const calculateMenuButtonOffset = () => {
      const menuButton = document.querySelector(
        '[aria-label="menu"]'
      ) as HTMLElement;
      if (menuButton) {
        // Calculate the right offset of the menu button
        const offset =
          window.innerWidth - menuButton.getBoundingClientRect().right;
        setMenuButtonOffset(offset);
      }
    };

    // Calculate it initially and also on resize
    calculateMenuButtonOffset();
    window.addEventListener("resize", calculateMenuButtonOffset);

    return () =>
      window.removeEventListener("resize", calculateMenuButtonOffset);
  }, []);

  const handleNavbarItemClick = (section: Section) => {
    setSelectedSection(section);
  };

  const renderNavbarItems = () =>
    Object.keys(dropdownData).map((navbarItem, index) => (
      <Grid2
        key={index}
        onClick={() =>
          handleNavbarItemClick(dropdownData[navbarItem as MenuKey].sections[0])
        }
        sx={{
          flexBasis: {
            xs: "100%", // Full width on extra small screens
            sm: "50%", // 50% width on small screens
            md: "25%", // 25% width on medium screens
          },
          "&:hover .arrow": {
            opacity: 1, // Show the arrow when the grid item is hovered
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
              opacity: 0, // Hide the arrow by default
              transition: "opacity 0.3s",
              marginRight: `${menuButtonOffset}px`, // Align the arrow with the menu button
              color: "white",
            }}
          >
            <ArrowForwardIosIcon />
          </Box>
        </Typography>
      </Grid2>
    ));

  const renderSection = (section: Section) => (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start", // Align items to the start of the flex container
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

  const renderSectionItems = (
    subSection: Section,
    isFirstSection?: boolean
  ) => {
    return subSection.items.map((item, itemIndex) => (
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
  };

  return (
    <Box sx={{ ...sx }}>
      {selectedSection ? (
        <Box>
          <Grid2 container spacing={1}>
            {renderSection(selectedSection)}
          </Grid2>
        </Box>
      ) : (
        <Grid2 container>{renderNavbarItems()}</Grid2>
      )}
    </Box>
  );
}
