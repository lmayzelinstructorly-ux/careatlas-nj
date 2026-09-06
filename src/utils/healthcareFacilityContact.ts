import type { HealthcareFacility } from "../types/healthcare";

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlaceholderValue(value: string) {
  return /^(?:n\/?a|none|not available|not listed|unknown)$/i.test(value.trim());
}

export function createSafeExternalUrl(value: unknown) {
  if (!hasText(value) || isPlaceholderValue(value)) return null;
  const trimmed = value.trim();
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function createPhoneHref(value: unknown) {
  if (!hasText(value) || isPlaceholderValue(value)) return null;
  const trimmed = value.trim();
  const extensionMatch = trimmed.match(/(?:ext\.?|x)\s*(\d+)$/i);
  const dialable = trimmed
    .replace(/(?:ext\.?|x)\s*\d+$/i, "")
    .replace(/[^\d+]/g, "");

  if (dialable.replace(/\D/g, "").length < 7) return null;
  return `tel:${dialable}${extensionMatch ? `;ext=${extensionMatch[1]}` : ""}`;
}

export function getFacilityPhoneDisplay(value: unknown) {
  if (!hasText(value) || isPlaceholderValue(value)) return null;
  const trimmed = value.trim();
  const extensionMatch = trimmed.match(/(?:ext\.?|x)\s*(\d+)$/i);
  const number = trimmed.replace(/(?:ext\.?|x)\s*\d+$/i, "").trim();

  if (!number) return null;
  return {
    extension: extensionMatch?.[1] ?? null,
    number
  };
}

export function getFacilityAddressLabel(facility: HealthcareFacility) {
  if (!hasText(facility.address) || isPlaceholderValue(facility.address)) {
    return null;
  }

  const cityStateLine = [
    facility.city,
    [facility.state, facility.postalCode].filter(hasText).join(" ")
  ].filter(hasText).join(", ");

  return [facility.address.trim(), cityStateLine].filter(hasText).join(", ");
}

function getFacilityDirectionsTarget(facility: HealthcareFacility) {
  if (
    typeof facility.latitude === "number" &&
    Number.isFinite(facility.latitude) &&
    facility.latitude >= -90 &&
    facility.latitude <= 90 &&
    typeof facility.longitude === "number" &&
    Number.isFinite(facility.longitude) &&
    facility.longitude >= -180 &&
    facility.longitude <= 180
  ) {
    return `${facility.latitude},${facility.longitude}`;
  }

  return getFacilityAddressLabel(facility);
}

export function getGoogleMapsDirectionsUrl(facility: HealthcareFacility) {
  const destination = getFacilityDirectionsTarget(facility);
  return destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : null;
}

export function getAppleMapsDirectionsUrl(facility: HealthcareFacility) {
  const destination = getFacilityDirectionsTarget(facility);
  return destination
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}`
    : null;
}
