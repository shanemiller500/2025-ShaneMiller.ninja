"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "../day-out.module.css";

// A horizontal row that scrolls by swipe, mouse wheel or the arrow buttons,
// with fades showing there's more off either edge.
export default function ScrollRow({ label, active, children }: { label: string; active: string; children: React.ReactNode }) {
  const row = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = row.current; if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    // Turn vertical wheel movement into sideways scrolling while the row can still move.
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || el.scrollWidth <= el.clientWidth) return;
      const atEnd = event.deltaY > 0 ? el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 : el.scrollLeft <= 0;
      if (atEnd) return;
      event.preventDefault(); el.scrollLeft += event.deltaY;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); el.removeEventListener("wheel", onWheel); window.removeEventListener("resize", update); };
  }, []);
  // Keep the selected chip in view, scrolling only the row (never the page).
  useEffect(() => {
    const el = row.current, chip = el?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!el || !chip) return;
    if (chip.offsetLeft < el.scrollLeft) el.scrollTo({ left: chip.offsetLeft - 40, behavior: "smooth" });
    else if (chip.offsetLeft + chip.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollTo({ left: chip.offsetLeft + chip.offsetWidth - el.clientWidth + 40, behavior: "smooth" });
  }, [active]);

  const nudge = (direction: number) => row.current?.scrollBy({ left: direction * row.current.clientWidth * 0.7, behavior: "smooth" });
  return <div className={`${styles.scrollRow} ${edges.left ? styles.fadeLeft : ""} ${edges.right ? styles.fadeRight : ""}`}>
    {edges.left && <button className={`${styles.scrollArrow} ${styles.arrowLeft}`} onClick={() => nudge(-1)} aria-label="Scroll left"><ChevronLeft size={22} aria-hidden /></button>}
    <nav ref={row} className={styles.groups} aria-label={label}>{children}</nav>
    {edges.right && <button className={`${styles.scrollArrow} ${styles.arrowRight}`} onClick={() => nudge(1)} aria-label="Scroll right"><ChevronRight size={22} aria-hidden /></button>}
  </div>;
}
