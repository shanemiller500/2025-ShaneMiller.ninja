import type { PointerEvent } from "react";

// Match the project cards without triggering a React render on pointer movement.
export function trackButtonSpotlight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === "touch" || !(event.target instanceof Element)) return;
  const button = event.target.closest("button");
  if (!button || button.disabled || !event.currentTarget.contains(button)) return;
  const rect = button.getBoundingClientRect();
  button.style.setProperty("--x", `${event.clientX - rect.left}px`);
  button.style.setProperty("--y", `${event.clientY - rect.top}px`);
}
