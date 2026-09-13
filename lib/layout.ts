/** The tab bar occupies layout space, so only add breathing room at scroll end. */
export const SCROLL_END_PADDING = 48;
export const WEB_CONTENT_MAX_WIDTH = 880;

export function getTabMetrics(web: boolean, bottomInset: number) {
  return web
    ? { height: 52, paddingTop: 2, paddingBottom: 2, iconSize: 21, labelSize: 10, labelMarginTop: 0, minTouchHeight: 44 }
    : { height: 56 + Math.max(bottomInset, 8), paddingTop: 8, paddingBottom: Math.max(bottomInset, 8), iconSize: 24, labelSize: 10, labelMarginTop: 2, minTouchHeight: 48 };
}
