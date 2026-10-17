/* ------------------------------------------------------------------ */
/*  Auto-rotating 3D views keep turning while the person zooms (wheel, */
/*  pinch, buttons); only a one-pointer drag — taking the camera to    */
/*  turn or move it — stops the orbit.                                 */
/* ------------------------------------------------------------------ */

/** Pixels a single pointer must travel before it counts as a drag. */
const DRAG_PX = 5;

/** Calls `onDrag` once per gesture in which one pointer (mouse or a single finger) drags across `el`. Two-finger pinches don't count. Returns a cleanup. */
export function onSinglePointerDrag(el: HTMLElement, onDrag: () => void): () => void {
  const down = new Map<number, { x: number; y: number }>();
  let fired = false;
  const start = (e: PointerEvent) => {
    // a fresh gesture (first finger down) can fire again
    if (!down.size) fired = false;
    down.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const end = (e: PointerEvent) => down.delete(e.pointerId);
  const move = (e: PointerEvent) => {
    const p = down.get(e.pointerId);
    if (fired || !p || down.size !== 1) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) >= DRAG_PX) {
      fired = true;
      onDrag();
    }
  };
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("pointerleave", end);
  return () => {
    el.removeEventListener("pointerdown", start);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", end);
    el.removeEventListener("pointercancel", end);
    el.removeEventListener("pointerleave", end);
  };
}
