export const careAtlasMapResetEvent = "careatlas:reset-map";

export function requestCareAtlasMapReset() {
  window.dispatchEvent(new Event(careAtlasMapResetEvent));
}
