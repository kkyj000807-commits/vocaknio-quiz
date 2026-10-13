/** Dynamic toolbar/keyboard height, not a second safe-area or tab padding. */
export function subscribeWebViewport(target: Window): () => void {
  const viewport = target.visualViewport;
  const style = target.document.documentElement.style;
  const previous = style.getPropertyValue("--finetune-viewport-height");
  const update = () => {
    // Pinch zoom must not relayout the app; browsers keep zoom/panning ownership.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
    const height = viewport?.height ?? target.innerHeight;
    if (Number.isFinite(height) && height > 0) style.setProperty("--finetune-viewport-height", `${height}px`);
  };
  update();
  target.addEventListener("resize", update);
  viewport?.addEventListener("resize", update);
  return () => {
    target.removeEventListener("resize", update);
    viewport?.removeEventListener("resize", update);
    if (previous) style.setProperty("--finetune-viewport-height", previous);
    else style.removeProperty("--finetune-viewport-height");
  };
}
