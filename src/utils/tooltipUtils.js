/**
 * Show an error tooltip near an object on screen, auto-dismissing after 2.5 s.
 *
 * @param {string}  msg               - Message to display in the tooltip
 * @param {{ screenX, screenY, objW, objH }} pos - Screen-space position/size of the object
 * @param {Function} setResizeTooltip - State setter for the tooltip
 * @param {{ current: number|null }}  resizeTooltipTimer - Ref holding the active dismiss timer
 */
export function showErrorTooltip(msg, { screenX, screenY, objW, objH }, setResizeTooltip, resizeTooltipTimer) {
  const flipY = screenY < 40;
  clearTimeout(resizeTooltipTimer.current);
  setResizeTooltip({
    x: screenX + objW / 2,
    y: flipY ? screenY + objH : screenY,
    msg,
    flipY,
  });
  resizeTooltipTimer.current = setTimeout(() => setResizeTooltip(null), 2500);
}
