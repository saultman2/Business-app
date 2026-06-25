export type MapProvider = "apple" | "google";

export function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMac = /Macintosh|Mac OS X/.test(ua);
  return isIOS || isMac;
}

export function defaultMapProvider(): MapProvider {
  return isAppleDevice() ? "apple" : "google";
}

export function buildFullAddress(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}): string {
  const line1 = parts.address?.trim() || "";
  const cityState = [parts.city?.trim(), parts.state?.trim()]
    .filter(Boolean)
    .join(", ");
  const tail = [cityState, parts.zipCode?.trim()].filter(Boolean).join(" ");
  return [line1, tail].filter(Boolean).join(", ");
}

export function navigationUrl(address: string, provider: MapProvider): string {
  const q = encodeURIComponent(address);
  return provider === "apple"
    ? `maps://?q=${q}`
    : `https://maps.google.com/?q=${q}`;
}
