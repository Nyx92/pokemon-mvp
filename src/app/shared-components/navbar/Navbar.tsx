"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "next-auth";
import { Theme } from "@mui/material";

import { APP_BAR_HEIGHT } from "./constants";
import { MenuKey } from "./DropdownStoreData";
import { useNavbarStore } from "../../store/navbarStore";
import { useUserStore } from "../../store/userStore";

import NavbarShell from "./NavbarShell";
import NavbarLogo from "./NavbarLogo";
import NavbarActionsRow from "./NavbarActionsRow";
import NavbarHamburgerButton from "./NavbarHamburgerButton";
import NavbarDropdown from "./NavbarDropdown";
import NavbarBackdrop from "./NavbarBackdrop";

import { useDevIconOffset } from "./hooks/useDevIconOffset";
import { useCloseMenuOnResize } from "./hooks/useCloseMenuOnResize";
import { useCloseOnBrowserMouseOut } from "./hooks/useCloseOnBrowserMouseOut";

import "./Navbar.css";

interface NavBarProps {
  initialUser?: Partial<Session["user"]> | null;
}

// Toggle this flag to enable or disable navbar effects
const disableNavEffects = true;

// React.FunctionComponent type is a special type provided by React for functional components.
// It automatically includes type definitions for props, including handling children as a prop.
const NavBar: React.FC<NavBarProps> = ({ initialUser }) => {
  const navbarRef = useRef<HTMLElement>(null as unknown as HTMLElement);
  // opens/closes the hamburger drop down menu
  const [currentMenu, setCurrentMenu] = useState<MenuKey | null>(null);
  // a timer that keeps track of the duration of mouse hover on page button
  const [delayTimer, setDelayTimer] = useState<NodeJS.Timeout | null>(null);
  // flag to prevent nav menu to close on load
  const [hasInteractedNav, setHasInteractedNav] = useState(false);
  // flag to prevent hamburger menu to close on load
  const [hasInteractedMenu, setHasInteractedMenu] = useState(false);
  // flag to prevent nav menu to open quickly on load
  const [allowNavDropdown, setAllowNavDropdown] = useState(false);
  const goToSignUp = () => (window.location.href = "/auth/signup");
  const goToSignIn = () => (window.location.href = "/auth/login");
  const goToProfile = () => (window.location.href = "/profile");

  // Zustand: states + actions
  const {
    // opens/closes the drop down nav
    anchorElNavOpen: anchorElNav,
    anchorElMenuNavOpen: anchorElMenuNav,
    selectedDropdownSection,
    // opens/closes the hamburger drop down menu
    setAnchorElNavOpen: setAnchorElNav,
    setAnchorElMenuNavOpen: setAnchorElMenuNav,
    setSelectedDropdownSection,
  } = useNavbarStore();

  // Zustand: user store — get user info
  const { user } = useUserStore();
  const isLoggedIn = Boolean(user?.username || initialUser?.username);

  // Combine server user and client user safely
  const displayUser = user?.username ?? initialUser?.username ?? "Profile";

  // allow hover dropdown only after a short delay (if enabled)
  useEffect(() => {
    if (disableNavEffects) return;
    const timer = setTimeout(() => setAllowNavDropdown(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // hooks for side effects
  const devIconOffset = useDevIconOffset(navbarRef);
  useCloseMenuOnResize({
    breakpoint: 960,
    onClose: () => setAnchorElMenuNav(false),
  });
  useCloseOnBrowserMouseOut({
    isOpen: anchorElNav,
    onClose: () => setAnchorElNav(false),
  });

  const dropdownAnimationNav = anchorElNav
    ? "slideDown 1s forwards"
    : hasInteractedNav
      ? "slideUp .5s forwards"
      : "none";

  const dropdownAnimationMenu = anchorElMenuNav
    ? "slideDown 1s forwards"
    : hasInteractedMenu
      ? "slideUp .5s forwards"
      : "none";

  const handleBackToMenu = () => setSelectedDropdownSection(null);

  const handleCloseNavMenu = () => setAnchorElNav(false);

  const handleMouseLeaveDropDown = () => setAnchorElNav(false);

  const handleMouseLeaveNavButton = () => {
    if (delayTimer) clearTimeout(delayTimer);
  };

  const handleMouseEnterNavButton = (page: MenuKey) => {
    if (!allowNavDropdown) return;
    setHasInteractedNav(true);

    const timer = setTimeout(() => {
      setCurrentMenu(page);
      setAnchorElNav(true);
    }, 300);

    setDelayTimer(timer);
  };

  const handleNavigate = (page: MenuKey) => {
    setAnchorElNav(false);
    window.location.href = `/${page.toLowerCase()}`;
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
      <NavbarBackdrop
        show={anchorElNav}
        topLg={`${APP_BAR_HEIGHT + 350}px`}
        topXl={`${APP_BAR_HEIGHT + 500}px`}
        onClick={handleCloseNavMenu}
      />

      <NavbarShell
        navbarRef={navbarRef}
        isDesktopDropdownOpen={anchorElNav}
        isMobileMenuOpen={anchorElMenuNav}
      >
        <NavbarLogo
          selectedDropdownSection={selectedDropdownSection}
          onBack={handleBackToMenu}
        />

        <NavbarActionsRow
          isDesktopDropdownOpen={anchorElNav}
          onNavigate={handleNavigate}
          onMouseEnter={handleMouseEnterNavButton}
          onMouseLeave={handleMouseLeaveNavButton}
          isLoggedIn={isLoggedIn}
          onSignUp={goToSignUp}
          onSignIn={goToSignIn}
          onProfile={goToProfile}
          profileName={displayUser}
        />

        <NavbarHamburgerButton onClick={handleMenuClick} />
      </NavbarShell>

      <NavbarDropdown
        variant="desktop"
        open={!!currentMenu && anchorElNav}
        top={APP_BAR_HEIGHT}
        animation={dropdownAnimationNav}
        onMouseLeave={handleMouseLeaveDropDown}
        devIconOffset={devIconOffset}
        currentMenu={currentMenu}
      />

      <NavbarDropdown
        variant="mobile"
        open={hasInteractedMenu && anchorElMenuNav}
        top={APP_BAR_HEIGHT}
        animation={dropdownAnimationMenu}
        onMouseLeave={handleMouseLeaveDropDown}
        devIconOffset={devIconOffset}
      />
    </>
  );
};

export default NavBar;
