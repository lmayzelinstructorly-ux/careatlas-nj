import { memo, useEffect, useState, type ReactNode } from "react";
import type {
  HealthcareDataReadinessLevel,
  HealthcareFacility,
  HealthcareFacilityDataQualityAudit,
  HealthcareFacilityType
} from "../types/healthcare";
import { getHealthcareFacilityAccessDetailItems } from "../utils/healthcareFacilityAccessDetails";
import {
  createPhoneHref,
  createSafeExternalUrl,
  getAppleMapsDirectionsUrl,
  getFacilityAddressLabel,
  getFacilityPhoneDisplay,
  getGoogleMapsDirectionsUrl
} from "../utils/healthcareFacilityContact";

type HealthcareFacilityReportCardProps = {
  dataQualityAudit?: HealthcareFacilityDataQualityAudit;
  expanded?: boolean;
  facility: HealthcareFacility;
  isDemoMode?: boolean;
  mode?: "compact" | "full";
  onClose?: () => void;
  selected?: boolean;
};

const facilityTypeLabels: Record<HealthcareFacilityType, string> = {
  hospital: "Hospital",
  clinic: "Clinic",
  urgent_care: "Urgent care",
  community_health_center: "Community health center",
  pharmacy: "Pharmacy",
  mental_health: "Mental health",
  dental: "Dental",
  other: "Other"
};

const readinessLabels: Record<HealthcareDataReadinessLevel, string> = {
  ready: "Ready",
  needs_review: "Needs review",
  insufficient_data: "Insufficient data"
};

function ReportList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="hb-facility-report__empty">No information is listed yet.</p>;
  }

  return (
    <ul className="hb-facility-report__list">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function ReportBadge({ children }: { children: ReactNode }) {
  return (
    <span className="hb-facility-report__badge hb-facility-report__badge--neutral">
      {children}
    </span>
  );
}

function getSourceDetails(facility: HealthcareFacility) {
  return [
    facility.sourceInfo?.sourceName ?? facility.sourceDataset ?? "Dataset name not listed.",
    facility.sourceInfo?.lastChecked ? `Source checked ${facility.sourceInfo.lastChecked}.` : "",
    facility.sourceLastUpdated ? `Source updated ${facility.sourceLastUpdated}.` : "",
    facility.lastVerified ? `Record verified ${facility.lastVerified}.` : "",
    facility.sourceInfo?.notes
  ].filter((item): item is string => Boolean(item));
}

function HealthcareFacilityReportCard({
  dataQualityAudit,
  expanded,
  facility,
  isDemoMode,
  mode = "compact",
  onClose,
  selected
}: HealthcareFacilityReportCardProps) {
  const isFullMode = mode === "full";
  const [addressCopyState, setAddressCopyState] = useState<"idle" | "copied" | "unavailable">("idle");
  const websiteUrl = createSafeExternalUrl(facility.website);
  const phoneHref = createPhoneHref(facility.phone);
  const phoneDisplay = getFacilityPhoneDisplay(facility.phone);
  const addressLabel = getFacilityAddressLabel(facility);
  const appleMapsUrl = getAppleMapsDirectionsUrl(facility);
  const googleMapsUrl = getGoogleMapsDirectionsUrl(facility);
  const accessDetails = getHealthcareFacilityAccessDetailItems(facility);
  const missingDetails = dataQualityAudit?.missingFields.map((field) => `${field} is not available.`) ?? [];
  const isDemoRecord = Boolean(isDemoMode || facility.isDemoData || facility.verificationStatus === "demo");

  useEffect(() => setAddressCopyState("idle"), [facility.id]);

  const handleCopyAddress = () => {
    if (!addressLabel || typeof navigator === "undefined" || !navigator.clipboard) {
      setAddressCopyState("unavailable");
      return;
    }
    navigator.clipboard.writeText(addressLabel)
      .then(() => setAddressCopyState("copied"))
      .catch(() => setAddressCopyState("unavailable"));
  };

  return (
    <article className={[
      "hb-facility-report",
      isFullMode ? "hb-facility-report--full" : "hb-facility-report--compact",
      selected ? "hb-facility-report--selected" : "",
      expanded ? "hb-facility-report--expanded" : ""
    ].filter(Boolean).join(" ")}>
      <div className="hb-facility-report__header">
        <div className="hb-facility-report__title-group">
          <p className="hb-facility-report__eyebrow">Source-backed facility record</p>
          <h3 className="hb-facility-report__title">{facility.name}</h3>
          <p className="hb-facility-report__meta">
            {facilityTypeLabels[facility.facilityType]}
            {[facility.city, facility.county, facility.state].filter(Boolean).length > 0
              ? ` in ${[facility.city, facility.county, facility.state].filter(Boolean).join(", ")}`
              : ""}
          </p>
        </div>
      </div>

      <div className="hb-facility-report__badges">
        <ReportBadge>{readinessLabels[dataQualityAudit?.readinessLevel ?? "needs_review"]}</ReportBadge>
        <ReportBadge>{facility.verificationStatus.replace("_", " ")}</ReportBadge>
        {isDemoRecord && <span className="hb-facility-report__badge hb-facility-report__badge--demo">Demo data</span>}
      </div>

      <p className="hb-facility-report__summary">
        This record shows documented facility information. Missing services, hours, insurance, cost or accessibility details remain unknown.
      </p>

      {isFullMode && (
        <section aria-label="Facility contact actions" className="hb-facility-report__actions">
          <div className="hb-facility-report__actions-heading">
            <h4>Contact and directions</h4>
            <p>Confirm current details directly with the facility.</p>
          </div>
          <div className="hb-facility-report__action-grid">
            {websiteUrl && <a className="hb-facility-report__action" href={websiteUrl} rel="noreferrer" target="_blank">Open facility website</a>}
            {phoneHref && phoneDisplay && <a className="hb-facility-report__action" href={phoneHref}>Call {phoneDisplay.number}{phoneDisplay.extension ? ` ext. ${phoneDisplay.extension}` : ""}</a>}
            {addressLabel && <button className="hb-facility-report__action" onClick={handleCopyAddress} type="button">Copy address</button>}
            {googleMapsUrl && <a className="hb-facility-report__action" href={googleMapsUrl} rel="noreferrer" target="_blank">Directions in Google Maps</a>}
            {appleMapsUrl && <a className="hb-facility-report__action" href={appleMapsUrl} rel="noreferrer" target="_blank">Directions in Apple Maps</a>}
          </div>
          {addressLabel && <p className="hb-facility-report__action-context">Address: {addressLabel}</p>}
          {addressCopyState !== "idle" && <p className="hb-facility-report__action-status" role="status">{addressCopyState === "copied" ? "Address copied." : "Address copy is unavailable in this browser."}</p>}
        </section>
      )}

      {isFullMode && (
        <details className="hb-facility-report__details">
          <summary>Record details</summary>
          <div className="hb-facility-report__details-content">
            <section className="hb-facility-report__section">
              <h4>Available access details</h4>
              <ReportList items={accessDetails} />
            </section>
            <section className="hb-facility-report__section">
              <h4>Missing fields</h4>
              <ReportList items={missingDetails} />
            </section>
            <section className="hb-facility-report__section">
              <h4>Source and provenance</h4>
              <ReportList items={getSourceDetails(facility)} />
              {facility.sourceInfo?.sourceUrl && (
                <a className="mt-3 inline-flex font-semibold text-hb-teal hover:underline" href={facility.sourceInfo.sourceUrl} rel="noreferrer" target="_blank">Open official source</a>
              )}
            </section>
          </div>
        </details>
      )}

      {isFullMode && onClose && <button className="hb-facility-report__close" onClick={onClose} type="button">Close report</button>}
      <p className="hb-facility-report__disclaimer">
        CareAtlas is a public-health evidence tool, not medical advice or a complete provider directory. Source and limitation details stay with each record.
      </p>
    </article>
  );
}

export default memo(HealthcareFacilityReportCard);
