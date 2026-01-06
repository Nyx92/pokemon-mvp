"use client";

import { useEffect } from "react";

export function useCloseOnBrowserMouseOut({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!event.relatedTarget && isOpen) onClose();
    };
    document.addEventListener("mouseout", handler);
    return () => document.removeEventListener("mouseout", handler);
  }, [isOpen, onClose]);
}
