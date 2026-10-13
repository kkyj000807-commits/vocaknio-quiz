/** The tab bar occupies layout space, so only add breathing room at scroll end. */
export const SCROLL_END_PADDING = 48;
export const WEB_CONTENT_MAX_WIDTH = 880;

export function getTabMetrics(web: boolean, bottomInset: number) {
  const safeBottom = Number.isFinite(bottomInset) ? Math.max(0, bottomInset) : 0;
  return web
    ? { height: 52 + safeBottom, paddingTop: 2, paddingBottom: 2 + safeBottom, iconSize: 21, labelSize: 10, labelMarginTop: 0, minTouchHeight: 44 }
    : { height: 56 + Math.max(safeBottom, 8), paddingTop: 8, paddingBottom: Math.max(safeBottom, 8), iconSize: 24, labelSize: 10, labelMarginTop: 2, minTouchHeight: 48 };
}
