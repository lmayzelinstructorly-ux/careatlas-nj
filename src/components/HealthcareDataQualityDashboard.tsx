import { useMemo } from "react";
import type {
  HealthcareDataReadinessLevel,
  HealthcareFacility
} from "../types/healthcare";
import { auditHealthcareFacilityData } from "../utils/healthcareDataQuality";
import type { HealthcareFacilitiesLoadState } from "../hooks/useHealthcareFacilities";

type HealthcareDataQualityDashboardProps = {
  facilities: HealthcareFacility[];
  isDemoMode: boolean;
  loadState: HealthcareFacilitiesLoadState;
};

const readinessLabels: Record<HealthcareDataReadinessLevel, string> = {
  ready: "Ready",
  needs_review: "Needs review",
  insufficient_data: "Insufficient data"
};

function getReadinessBadgeClass(readinessLevel: HealthcareDataReadinessLevel) {
  if (readinessLevel === "ready") {
    return "border-hb-green/35 bg-hb-green/12 text-[#2d7d25]";
  }

  if (readinessLevel === "needs_review") {
    return "border-hb-aqua/35 bg-hb-aqua/12 text-hb-teal";
  }

  return "border-hb-navy/20 bg-hb-background text-hb-navy";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getFacilitySourceText(facility: HealthcareFacility) {
  return [
    facility.sourceDataset,
    facility.sourceInfo?.sourceName,
    facility.sourceInfo?.sourceUrl,
    facility.sourceInfo?.notes
  ]
    .map(normalizeText)
    .join(" ");
}

function isHrsaFacility(facility: HealthcareFacility) {
  const sourceText = getFacilitySourceText(facility);

  return (
    sourceText.includes("hrsa") &&
    sourceText.includes("health center service delivery")
  );
}

function isCmsHospitalFacility(facility: HealthcareFacility) {
  const sourceText = getFacilitySourceText(facility);

  return (
    sourceText.includes("hospital general information") ||
    sourceText.includes("cms")
  );
}

function HealthcareDataQualityDashboard({
  facilities,
  isDemoMode,
  loadState
}: HealthcareDataQualityDashboardProps) {
  const audit = useMemo(
    () => auditHealthcareFacilityData(facilities),
    [facilities]
  );
  const missingCoverageItems = [
    { label: "Coordinates", value: audit.percentWithCoordinates },
    { label: "Source URLs", value: audit.percentWithSourceUrls },
    { label: "Price info", value: audit.percentWithPriceInfo },
    { label: "Insurance info", value: audit.percentWithInsuranceInfo },
    { label: "Hours", value: audit.percentWithHours },
    { label: "Services", value: audit.percentWithServices }
  ];
  const sourceBackedCount = facilities.filter(
    (facility) => facility.isDemoData !== true && Boolean(facility.sourceInfo?.sourceName)
  ).length;
  const enrichmentSourceStatuses = facilities.reduce(
    (counts, facility) => {
      for (const source of Object.values(facility.fieldSources ?? {})) {
        if (source?.status === "source_backed") counts.sourceBacked += 1;
        if (source?.status === "needs_review") counts.needsReview += 1;
      }
      return counts;
    },
    { sourceBacked: 0, needsReview: 0 }
  );
  const enrichmentFieldSlots = facilities.length * 5;
  const enrichmentMissing = Math.max(
    0,
    enrichmentFieldSlots - enrichmentSourceStatuses.sourceBacked - enrichmentSourceStatuses.needsReview
  );
  const hrsaFacilities = facilities.filter(isHrsaFacility);
  const cmsHospitalFacilities = facilities.filter(isCmsHospitalFacility);
  const loadedProductionStates = [
    ...new Set(
      [...hrsaFacilities, ...cmsHospitalFacilities].map(
        (facility) => facility.state
      )
    )
  ].sort();

  return (
    <section className="rounded-lg border border-hb-aqua/25 bg-gradient-to-br from-white via-hb-background to-hb-green/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-hb-teal">
            Data readiness audit
          </p>
          <h2 className="mt-2 text-base font-black leading-tight text-hb-deepNavy">
            Data quality check
          </h2>
        </div>
        <span
          className={[
            "rounded-md border px-2 py-1 text-[10px] font-black uppercase leading-none tracking-[0.08em]",
            getReadinessBadgeClass(audit.readinessLevel)
          ].join(" ")}
        >
          {readinessLabels[audit.readinessLevel]}
        </span>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-hb-muted">
        Data readiness checks whether facility records have enough verified data
        for responsible public display and source review.
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-hb-muted">
        Low data quality does not mean a facility is bad. It means
        CareAtlas needs better source-backed information.
      </p>

      {isDemoMode && (
        <div className="mt-3 rounded-lg border border-hb-aqua/30 bg-hb-background px-3 py-3">
          <p className="text-sm font-black text-hb-deepNavy">
            Demo healthcare data mode
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-hb-muted">
            These records are sample/demo data and should not be treated as real
            healthcare facilities.
          </p>
        </div>
      )}

      {(hrsaFacilities.length > 0 || cmsHospitalFacilities.length > 0) && (
        <div className="mt-3 rounded-lg border border-hb-green/25 bg-hb-green/10 px-3 py-3">
          <p className="text-sm font-black text-[#2d7d25]">
            Regional production data loaded from official federal sources.
          </p>
          {hrsaFacilities.length > 0 && (
            <p className="mt-1 text-xs font-semibold leading-5 text-hb-muted">
              {hrsaFacilities.length} community health center records are from
              the HRSA Health Center Service Delivery and Look-Alike Sites
              source.
            </p>
          )}
          {cmsHospitalFacilities.length > 0 && (
            <p className="mt-1 text-xs font-semibold leading-5 text-hb-muted">
              {cmsHospitalFacilities.length} hospital records are from the CMS
              Hospital General Information source, with Census-geocoded
              addresses. CMS quality ratings are intentionally not imported.
            </p>
          )}
          <p className="mt-1 text-xs font-semibold leading-5 text-hb-muted">
            Loaded states: {loadedProductionStates.join(", ")}. Unknown fields
            are not estimated; verify details with official facility or source
            information.
          </p>
        </div>
      )}

      {(loadState === "idle" || loadState === "loading") && (
        <p className="mt-3 rounded-lg border border-hb-aqua/20 bg-white/80 px-3 py-2 text-sm font-semibold text-hb-muted">
          Loading source-backed healthcare records...
        </p>
      )}

      {loadState === "error" && (
        <p className="mt-3 rounded-lg border border-hb-aqua/25 bg-hb-background px-3 py-2 text-sm font-semibold leading-5 text-hb-navy">
          Healthcare data could not be loaded right now. Boundary map and search
          remain available.
        </p>
      )}

      {loadState === "ready" && (
        <>
          {audit.emptyMessage ? (
            <p className="mt-3 rounded-lg border border-hb-border bg-white/84 px-3 py-2 text-sm leading-6 text-hb-muted">
              {audit.emptyMessage}
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-hb-border bg-white/86 px-3 py-2">
                <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                  Facilities
                </p>
                <p className="mt-1 text-xl font-black leading-none text-hb-deepNavy">
                  {audit.totalFacilities}
                </p>
              </div>
              <div className="rounded-lg border border-hb-border bg-white/86 px-3 py-2">
                <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                  Quality
                </p>
                <p className="mt-1 text-xl font-black leading-none text-hb-deepNavy">
                  {audit.averageQualityScore}/100
                </p>
              </div>
              <div className="rounded-lg border border-hb-border bg-white/86 px-3 py-2">
                <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                  Verified
                </p>
                <p className="mt-1 text-xl font-black leading-none text-hb-deepNavy">
                  {audit.verifiedCount}
                </p>
              </div>
              <div className="rounded-lg border border-hb-border bg-white/86 px-3 py-2">
                <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                  Source-backed
                </p>
                <p className="mt-1 text-xl font-black leading-none text-hb-deepNavy">
                  {sourceBackedCount}
                </p>
              </div>
            </div>
          )}

          <div className="mt-3 rounded-lg border border-hb-aqua/20 bg-white/82 px-3 py-3">
            <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
              Source-backed field coverage
            </p>
            <p className="mt-1 text-[11px] font-bold leading-5 text-hb-muted">
              Percentages show how much of the loaded dataset has each field
              supported by available data. Unknown fields are not estimated.
            </p>
            <div className="mt-2 grid gap-2">
              {missingCoverageItems.map((item) => (
                <div
                  className="flex items-center justify-between gap-2 text-xs font-bold"
                  key={item.label}
                >
                  <span className="text-hb-muted">{item.label}</span>
                  <span className="text-hb-deepNavy">{item.value}% complete</span>
                </div>
              ))}
            </div>
          </div>

          {audit.topDataGaps.length > 0 && (
            <div className="mt-3 rounded-lg border border-hb-aqua/20 bg-white/82 px-3 py-3">
              <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                Top data gaps
              </p>
              <ul className="mt-2 grid gap-1">
                {audit.topDataGaps.map((gap) => (
                  <li
                    className="flex items-center justify-between gap-2 text-xs font-semibold leading-5"
                    key={gap.label}
                  >
                    <span className="text-hb-muted">{gap.label}</span>
                    <span className="font-black text-hb-deepNavy">
                      {gap.count} ({gap.percent}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 rounded-lg border border-hb-aqua/20 bg-white/82 px-3 py-3">
            <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
              Field-level enrichment provenance
            </p>
            <ul className="mt-2 grid gap-1 text-xs font-semibold leading-5 text-hb-muted">
              <li>Present and source-backed: {enrichmentSourceStatuses.sourceBacked}</li>
              <li>Needs review: {enrichmentSourceStatuses.needsReview}</li>
              <li>Missing because no field-level source was provided: {enrichmentMissing}</li>
            </ul>
          </div>

          <p className="mt-3 text-[11px] font-bold leading-5 text-hb-muted">
            This audit measures data completeness and verification only. It
            does not measure medical quality, recommend care or provide medical
            advice.
          </p>
          <p className="mt-2 text-[11px] font-bold leading-5 text-hb-muted">
            Facility data is source-backed when available. Unknown hours,
            prices or insurance fields are not estimated.
          </p>
        </>
      )}
    </section>
  );
}

export default HealthcareDataQualityDashboard;
