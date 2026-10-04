// The street's power lines, as quadratic curves [x0, y0, cx, cy, x1, y1] in the Shopfronts drawing's
// units (they match the wire paths it draws), shared by the drawing (shoes on the wires) and the
// game (the fruit bats hanging off them).
export const WIRES = {
  leftLow: [-592, 100, -300, 160, 0, 140], leftHigh: [-592, 76, -300, 124, 0, 110],
  midLow: [0, 140, 360, 165, 694, 70], midHigh: [0, 110, 360, 132, 702, 92],
  rightHigh: [758, 70, 1580, 150, 2410, 70], rightLow: [750, 92, 1580, 175, 2410, 104],
};
export type WireName = keyof typeof WIRES;
// Rounded so the server and the browser get exactly the same numbers (hydration).
const rd = (n: number) => Math.round(n * 100) / 100;
// The point a fraction t of the way along a wire.
export const onWire = (w: number[], t: number) => {
  const [x0, y0, cx, cy, x1, y1] = w, u = 1 - t;
  return { x: rd(u * u * x0 + 2 * u * t * cx + t * t * x1), y: rd(u * u * y0 + 2 * u * t * cy + t * t * y1) };
};
