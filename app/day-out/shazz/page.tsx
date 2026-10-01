"use client";

import SmartArse from "../components/SmartArse";
import styles from "../day-out.module.css";

// Bogan Street, full screen: just Shazz and the street, nothing else. The street fills the screen
// at its real proportions and scrolls sideways; phones are asked to turn sideways.
export default function ShazzStreetPage() {
  return <div className={`${styles.root} ${styles.immersivePage}`}>
    <SmartArse topic="Bogan Street" summon={1} immersive />
  </div>;
}
