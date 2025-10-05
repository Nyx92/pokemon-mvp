"use client";

import { useState, useEffect, useRef } from "react";
import {
  Button,
  Container,
  Link,
  Toolbar,
  Box,
  AppBar,
  IconButton,
  Theme,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { APP_BAR_HEIGHT } from "./constants";
import { useNavbarStore } from "../../store/navbarStore";
import DropdownStoreNav from "./DropdownStoreNav";
import DropdownStoreNavMenu from "./DropdownStoreNavMenu";

import "./Navbar.css";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { MenuKey } from "./DropdownStoreData";

// Add "Blog" here if required
const pages: MenuKey[] = ["Profile"];
// Toggle this flag to enable or disable navbar effects
const disableNavEffects = true;

// React.FunctionComponent) type is a special type provided by React for functional components.
// It automatically includes type definitions for props, including handling children as a prop.
const NavBar: React.FC = () => {
  // these are used to calculated the left bound of the icon
  // so the elements in the drop down can be aligned
  const navbarRef = useRef<HTMLDivElement | null>(null);
  const [devIconOffset, setDevIconOffset] = useState<number>(0);

  // opens/closes the hamburger drop down menu
  const [currentMenu, setCurrentMenu] = useState<MenuKey | "">(""); // This ensures the type is compatible
  // a timer that keeps track of the duration of mouse hover on page button
  const [delayTimer, setDelayTimer] = useState<NodeJS.Timeout | null>(null);
  // flag to prevent nav menu to close on load
  const [hasInteractedNav, setHasInteractedNav] = useState<boolean>(false);
  // flag to prevent hamburger menu to close on load
  const [hasInteractedMenu, setHasInteractedMenu] = useState<boolean>(false);
  // flag to prevent nav menu to open quickly on load
  const [allowNavDropdown, setAllowNavDropdown] = useState<boolean>(false);

  // Zustand store states + actions
  const {
    // opens/closes the drop down nav
    anchorElNavOpen: anchorElNav,
    anchorElMenuNavOpen: anchorElMenuNav,
    selectedDropdownSection,
    setAnchorElNavOpen: setAnchorElNav,
    // opens/closes the hamburger drop down menu
    setAnchorElMenuNavOpen: setAnchorElMenuNav,
    setSelectedDropdownSection,
  } = useNavbarStore();

  const dropdownAnimationNav = anchorElNav
    ? // .css file contains slide animation
      "slideDown 1s forwards"
    : // prevents default slide up on load because state is by default, false
      hasInteractedNav
      ? "slideUp .5s forwards"
      : "none";

  const dropdownAnimationMenu = anchorElMenuNav
    ? "slideDown 1s forwards"
    : hasInteractedMenu
      ? "slideUp .5s forwards"
      : "none";

  // to prevent navbar dropdown to immediately fire on menu button click
  useEffect(() => {
    if (disableNavEffects) return;
    const timer = setTimeout(() => {
      setAllowNavDropdown(true);
    }, 500); // Adjust the delay as needed

    return () => clearTimeout(timer); // Cleanup the timer
  }, []);

  // to track if menu dropdown needs to be removed on large screen sizes
  useEffect(() => {
    // Define a function that will be called on window resize
    const handleResize = () => {
      // Check if the window width is greater than the mobile breakpoint width
      if (window.innerWidth > 960) {
        setAnchorElMenuNav(false);
      }
    };
    // Add the resize event listener
    window.addEventListener("resize", handleResize);
    // Clean up the event listener when the component is unmounted
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []); // The empty array ensures this effect runs only on mount and unmount

  // to track mouse movement out of the browser
  useEffect(() => {
    // When the mouse leaves the browser viewport or the document area, the handleBrowserMouseOut function is invoked
    document.addEventListener("mouseout", handleBrowserMouseOut);
    // cleanup function, for pages that does not have navbar
    return () => {
      document.removeEventListener("mouseout", handleBrowserMouseOut);
    };
  }, [anchorElNav]);

  // to calculating the horizontal offset icon with the aria-label="DevIcon" inside the navbar.
  const debounce = (fn: () => void, delay: number) => {
    let timer: NodeJS.Timeout;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fn();
      }, delay);
    };
  };

  useEffect(() => {
    const calculateDevIconOffset = () => {
      //  if navbarRef.current exists. Important because it's possible that the ref hasn't been attached to any DOM element yet, during render, so .current might be null.
      if (navbarRef.current) {
        // scope our search to only the descendants of the navbar.
        // useRef() hook has a property named .current that holds the actual reference, which you can use to access the DOM element
        const devIcon = navbarRef.current.querySelector(
          '[aria-label="DevIcon"]'
        );
        // If the icon is found, it calculates the left offset of the icon
        if (devIcon) {
          //  returns a DOMRect object which provides information about the size of an element and its position relative to the viewport (in pixels).
          setDevIconOffset(devIcon.getBoundingClientRect().left);
        }
      }
    };
    // ensures that calculateDevIconOffset don't get called too many times during window resizing
    const debouncedCalculate = debounce(calculateDevIconOffset, 200);
    // Calculate left offset of the icon
    debouncedCalculate();
    // Add an event listener for window resize
    window.addEventListener("resize", calculateDevIconOffset);
    // Cleanup: remove the event listener when the component is unmounted
    return () => {
      window.removeEventListener("resize", calculateDevIconOffset);
    };
    // event listener has been set up, so useEffect only need to be ran once
  }, []);

  // this adds a layer on the rest of the webpage when nav's dropdown is triggered
  const Backdrop: React.FC<{ show: boolean }> = ({ show }) => (
    <Box
      sx={{
        position: "fixed",
        top: { lg: APP_BAR_HEIGHT + "350px", xl: APP_BAR_HEIGHT + "500px" }, // 350px & 500px is the dropdown height
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1200, // Below the navbar but above everything else
        display: show ? "block" : "none",
      }}
      onClick={handleCloseNavMenu} // Close nav menu when backdrop is clicked
    />
  );

  // Handle back click to reset the selected section
  const handleBackToMenu = () => {
    setSelectedDropdownSection(null); // Reset the selection
    // Additional logic to close dropdown or navigate can be added here
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(false);
  };

  // when mouse leaves the dropdown menu
  const handleMouseLeaveDropDown = () => {
    setAnchorElNav(false);
  };

  // mechanism to clear the timeout when the mouse leaves the button before the 100ms has completed, otherwise it's additive
  const handleMouseLeaveNavButton = () => {
    if (delayTimer) {
      clearTimeout(delayTimer);
    }
  };

  // when mouse enters navbar button
  const handleMouseEnterNavButton = (page: MenuKey) => {
    if (!allowNavDropdown) return; // Prevent execution if not allowed
    setHasInteractedNav(true);

    // timer to prevent erratic effects due to rapid mouse movement at navbar
    const timer = setTimeout(() => {
      // remembers which button is being hovered, used by DropdDownStoreNav
      setCurrentMenu(page);
      // opens dropdown
      setAnchorElNav(true);
    }, 300);
    setDelayTimer(timer);
  };

  // when mouse leaves the extended navbar, i.e., out of browser
  const handleBrowserMouseOut = (event: MouseEvent) => {
    // The relatedTarget property gets the element the mouse moved to if false, means it goes out of browser
    if (!event.relatedTarget && anchorElNav) {
      setAnchorElNav(false);
    }
  };

  const handleNavigate = (page: MenuKey) => {
    // Close the nav menu
    setAnchorElNav(false);
    // Your existing navigation code
    const targetPath = `/${page.toLowerCase()}`;
    window.location.href = targetPath;
  };

  const handleMenuClick = () => {
    if (anchorElMenuNav) {
      setAnchorElMenuNav(false);
    } else {
      setAnchorElMenuNav(true);
      setHasInteractedMenu(true);
    }
  };

  return (
    <>
      {anchorElNav && <Backdrop show={anchorElNav} />}
      <AppBar
        // attach a reference for menu to anchor
        ref={navbarRef}
        className={anchorElNav ? "app-bar-black-bg" : ""}
        position="fixed"
        sx={{
          zIndex: 1300,
          width: "100%",
          height: APP_BAR_HEIGHT,
          backgroundColor: anchorElMenuNav
            ? "black" // If anchorElMenuNav is true, set AppBar background to black immediately
            : anchorElNav
              ? "black" // If anchorElNav is true, set AppBar background to black
              : "rgba(22, 22, 23, .8)", // Default background color when neither is true
          transition: anchorElMenuNav
            ? "none" // No transition for anchorElMenuNav to change color immediately
            : anchorElNav
              ? "background-color 0.3s" // Transition speed when anchorElNav is true
              : "background-color 0.5s 0.3s", // Transition with delay when anchorElNav is false
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* A responsive fixed-width container, using maxWidth, to prevent element from stretching indefinitely  */}
        <Container maxWidth="xl">
          {/* The Toolbar component is a container for grouping and arranging various UI elements within the AppBar */}
          <Toolbar
            disableGutters
            sx={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                width: "80%",
              }}
            >
              {/* Wrap Logo dev icon & logo */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  flexGrow: 1,
                }}
              >
                {selectedDropdownSection ? (
                  <IconButton
                    onClick={handleBackToMenu}
                    aria-label="Back"
                    sx={{
                      padding: 0,
                      color: "var(--r-globalnav-color-secondary)",
                      "&:hover": {
                        color: "var(--r-globalnav-color-hover)",
                      },
                    }}
                  >
                    <ArrowBackIosNewIcon />
                  </IconButton>
                ) : (
                  <Link href="/" underline="none">
                    {/* change to logo if applicable */}
                    {/* <Box
                      aria-label="DevIcon"
                      component="img"
                      src="/logowhite.png"
                      alt="Logo"
                      sx={{
                        width: "100px",
                        cursor: "pointer", // Adds a pointer cursor on hover to indicate clickability
                      }}
                    /> */}
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: "bold",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      Logo here
                    </Typography>
                  </Link>
                )}
              </Box>
              {/* The nav buttons */}
              {pages.map((page) => (
                <Button
                  key={page}
                  onClick={() => handleNavigate(page)}
                  onMouseEnter={() => handleMouseEnterNavButton(page)}
                  onMouseLeave={handleMouseLeaveNavButton}
                  sx={{
                    color: anchorElNav
                      ? "var(--r-globalnav-color-hover)"
                      : "var(--r-globalnav-color-secondary)",
                    textTransform: "capitalize",
                    backgroundColor: "transparent",
                    fontWeight: 100,
                    fontSize: { md: 12, lg: 15 },
                    transition: "color 0.3s",
                    // This ensures it's visible only on medium screens and bigger
                    display: { xs: "none", md: "flex" },
                  }}
                >
                  {page}
                </Button>
              ))}
              {/* hamburger menu button */}
              <IconButton
                size="large"
                edge="end"
                color="inherit"
                aria-label="menu"
                onClick={handleMenuClick}
                // This ensures it's visible only on screen size smaller than medium screens
                sx={{
                  display: { xs: "flex", md: "none" },
                }}
              >
                <MenuIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      {/* Menu DropDown for regular navbar button */}
      {currentMenu && (
        <Box
          sx={{
            position: "fixed",
            top: APP_BAR_HEIGHT, // Position the dropdown below the AppBar wherer AppBar height is 60px
            left: 0,
            width: "100vw",
            zIndex: 1300, // Ensure it's above other components
            boxShadow: "0px 3px 10px rgba(0,0,0,0.1)",
            animation: dropdownAnimationNav,
            overflow: "hidden", // ensures that only the portion of content fitting within the current max-height value is shown, creating the effect of the content "sliding" into or out of view.
            maxHeight: anchorElNav ? "550px" : "0",
            backgroundColor: "black",
            display: "flex",
            flexDirection: "row",
            height: { md: 380, lg: 420, xl: 550 },
          }}
          onMouseLeave={handleMouseLeaveDropDown}
        >
          {/* This Box serves as a container for the four columns inside the dropdown menu. */}
          <Box sx={{ width: "100%" }}>
            {/* The devIconOffset state holds the horizontal distance
            from the left side of the viewport to the LogoDevIcon, ensuring that it is aligned with the pos of LogodevIcon */}
            {/* sends currentMenu prop to DropdownStore component to identify what dropdown to render */}
            <DropdownStoreNav
              sx={{
                marginLeft: `${devIconOffset}px`,
                marginTop: (theme: Theme) => theme.spacing(4),
                color: "white",
              }}
              currentMenu={currentMenu}
            />
          </Box>
        </Box>
      )}
      {/* Menu DropDown for hamburger menu button */}
      {hasInteractedMenu && (
        <Box
          sx={{
            position: "fixed",
            top: APP_BAR_HEIGHT, // Position the dropdown below the AppBar wherer AppBar height is 60px
            left: 0,
            width: "100vw",
            zIndex: 1300, // Ensure it's above other components
            boxShadow: "0px 3px 10px rgba(0,0,0,0.1)",
            animation: dropdownAnimationMenu,
            overflow: "hidden", // ensures that only the portion of content fitting within the current max-height value is shown, creating the effect of the content "sliding" into or out of view.
            backgroundColor: "black",
            display: "flex",
            height: "100%",
          }}
          onMouseLeave={handleMouseLeaveDropDown}
        >
          {/* This Box serves as a container for the four columns inside the dropdown menu. */}
          <Box sx={{ width: "100%" }}>
            {/* The devIconOffset state holds the horizontal distance
            from the left side of the viewport to the LogoDevIcon, ensuring that it is aligned with the pos of LogodevIcon */}
            <DropdownStoreNavMenu
              sx={{
                // this is to align the dropdown nav content in DropdownStoreMenu with the logo
                marginLeft: `${devIconOffset}px`,
                marginTop: (theme: Theme) => theme.spacing(4),
                color: "white",
              }}
            />
          </Box>
        </Box>
      )}
    </>
  );
};

export default NavBar;
