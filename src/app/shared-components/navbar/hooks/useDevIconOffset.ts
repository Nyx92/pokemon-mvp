"use client";

import { useEffect, useState } from "react";

export function useDevIconOffset(navbarRef: React.RefObject<HTMLElement>) {
  const [devIconOffset, setDevIconOffset] = useState(0);

  useEffect(() => {
    const calculate = () => {
      if (!navbarRef.current) return;
      const devIcon = navbarRef.current.querySelector('[aria-label="DevIcon"]');
      if (!devIcon) return;
      setDevIconOffset((devIcon as HTMLElement).getBoundingClientRect().left);
    };

    let t: NodeJS.Timeout | null = null;
    const debounced = () => {
      if (t) clearTimeout(t);
      t = setTimeout(calculate, 200);
    };

    debounced();
    window.addEventListener("resize", debounced);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("resize", debounced);
    };
  }, [navbarRef]);

  return devIconOffset;
}
