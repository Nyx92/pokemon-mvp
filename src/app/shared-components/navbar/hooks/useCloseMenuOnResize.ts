"use client";

import { useEffect } from "react";

export function useCloseMenuOnResize({
  breakpoint,
  onClose,
}: {
  breakpoint: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > breakpoint) onClose();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint, onClose]);
}
