"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Close a game popup when the pointer lands outside it. A world tap used to
 * dismiss an action picker must not also paint or issue an order beneath it. */
export function useClickAway(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void, consumeWorld = true) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || ref.current?.contains(target)) return;
      // Portaled dialogs own their backdrop and must receive the first tap.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      closeRef.current();
      if (consumeWorld && target instanceof HTMLCanvasElement && target.hasAttribute("data-dl-world-canvas")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"][aria-modal="true"]')) closeRef.current();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape);
    };
  }, [open, ref, consumeWorld]);
}
