import type { HealthcareFacility } from "../types/healthcare";
import {
  createPhoneHref,
  createSafeExternalUrl,
  getAppleMapsDirectionsUrl,
  getFacilityAddressLabel,
  getFacilityPhoneDisplay,
  getGoogleMapsDirectionsUrl
} from "../utils/healthcareFacilityContact";

export function HealthcareFacilityContactLinks({
  compact = false,
  facility
}: {
  compact?: boolean;
  facility: HealthcareFacility;
}) {
  const addressLabel = getFacilityAddressLabel(facility);
  const appleMapsUrl = getAppleMapsDirectionsUrl(facility);
  const googleMapsUrl = getGoogleMapsDirectionsUrl(facility);
  const phoneDisplay = getFacilityPhoneDisplay(facility.phone);
  const phoneHref = createPhoneHref(facility.phone);
  const websiteUrl = createSafeExternalUrl(facility.website);
  const contactLinkClass = compact
    ? "text-[13px] font-bold leading-5 text-hb-teal underline decoration-hb-aqua/60 underline-offset-2 hover:text-hb-navy"
    : "text-sm font-semibold leading-5 text-hb-navy underline decoration-hb-aqua/60 underline-offset-2 hover:text-hb-teal";
  const directionsLinkClass = compact
    ? "inline-flex min-h-7 items-center rounded-md border border-hb-aqua/30 bg-hb-background px-2 py-1 text-xs font-bold leading-4 text-hb-navy hover:border-hb-aqua hover:bg-white"
    : "inline-flex min-h-8 items-center rounded-md border border-hb-aqua/30 bg-hb-background px-2.5 py-1 text-sm font-semibold leading-5 text-hb-navy hover:border-hb-aqua hover:bg-white";

  return (
    <div className={compact ? "mt-3 space-y-2.5" : "mt-3 space-y-3"}>
      {addressLabel && (
        <p className={`${compact ? "text-xs leading-[1.45]" : "text-sm leading-5"} text-slate-600`}>
          {addressLabel}
        </p>
      )}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        {phoneHref && phoneDisplay && (
          <a className={contactLinkClass} href={phoneHref}>
            Call {phoneDisplay.number}
            {phoneDisplay.extension && (
              <span className="whitespace-nowrap font-semibold text-slate-600">
                {" "}ext. {phoneDisplay.extension}
              </span>
            )}
          </a>
        )}
        {websiteUrl ? (
          <a className={contactLinkClass} href={websiteUrl} rel="noreferrer" target="_blank">
            Facility website
          </a>
        ) : (
          <span className={`${compact ? "text-xs" : "text-sm"} leading-5 text-hb-muted`}>
            Website not listed
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${compact ? "text-xs" : "text-sm"} mr-0.5 font-semibold leading-5 text-hb-muted`}>
          Directions
        </span>
        {googleMapsUrl && (
          <a className={directionsLinkClass} href={googleMapsUrl} rel="noreferrer" target="_blank">
            Google Maps
          </a>
        )}
        {appleMapsUrl && (
          <a className={directionsLinkClass} href={appleMapsUrl} rel="noreferrer" target="_blank">
            Apple Maps
          </a>
        )}
      </div>
    </div>
  );
}
