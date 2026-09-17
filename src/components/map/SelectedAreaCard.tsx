import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { HealthcareFacilitiesLoadState } from "../../hooks/useHealthcareFacilities";
import { useCountyGapSummary } from "../../hooks/useCountyGapSummary";
import { useTownGapContext } from "../../hooks/useTownGapContext";
import { useTractPublicRecord } from "../../hooks/useTractPublicRecord";
import type { SelectedGeography } from "../../types";
import type { HealthcareFacility } from "../../types/healthcare";
import type { TownTractScreeningContext } from "../../types/townGapContext";
import type {
  TractPublicRecord,
  TractPublicRuleInput
} from "../../types/tractPublicRecord";
import { getTractClassificationVisual } from "../../utils/tractClassification";
import {
  getTractFacilityProximity,
  type TractFacilityProximity
} from "../../utils/tractFacilityProximity";
import {
  getSelectedGeographyLevelLabel,
  getSelectedGeographyOfficialId
} from "./boundaryStyle";
import { HealthcareFacilityContactLinks } from "../HealthcareFacilityContactLinks";
import {
  buildMapPermalinkUrl,
  getMapPermalinkTarget
} from "./mapPermalink";
import { TownFlaggedTractList } from "./TownFlaggedTractList";
import { ActionPaths, GapDriverContext } from "./TractGapContext";
import { TractResultExplanation } from "./TractResultExplanation";
import { TractSourceSummary } from "./TractSourceSummary";

export type SelectedAreaCardProps = {
  activeTractCounty: SelectedGeography | null;
  activeTractTown: SelectedGeography | null;
  facilities: HealthcareFacility[];
  facilityLoadState: HealthcareFacilitiesLoadState;
  onBackToSummary: () => void;
  onClear: () => void;
  onCloseTractMode: () => void;
  onOpenTractMode: (area: SelectedGeography) => void;
  onSelectFlaggedTract: (area: SelectedGeography, geoid: string) => void;
  selectedGeography: SelectedGeography | null;
  tractMode: boolean;
};

function DataQualityFlag({ children, label }: { children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-expanded={open}
        aria-label={label}
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-amber-500/45 bg-amber-50 text-base font-bold text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        onClick={() => setOpen((current) => !current)}
        title={label}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 18 20"
        >
          <path
            d="M4.5 17.5V2.5M5.5 3.5h8l-2 3 2 3h-8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>
      {open && (
        <div className="mt-2 w-full basis-full rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-slate-700">
          {children}
        </div>
      )}
    </>
  );
}

function downloadJsonRecord(filename: string, record: unknown) {
  const objectUrl = URL.createObjectURL(
    new Blob([`${JSON.stringify(record, null, 2)}\n`], {
      type: "application/json"
    })
  );
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = objectUrl;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function BriefActions({
  allowPrint,
  geography
}: {
  allowPrint: boolean;
  geography: SelectedGeography;
}) {
  const [copyState, setCopyState] = useState<
    "idle" | "copied" | "unavailable"
  >("idle");
  const target = getMapPermalinkTarget(geography.level, geography.geoid);
  const shareUrl = target
    ? buildMapPermalinkUrl(target, window.location.href).href
    : window.location.href;

  useEffect(() => setCopyState("idle"), [target?.geoid, target?.kind]);

  function copyLink() {
    if (!navigator.clipboard) {
      setCopyState("unavailable");
      return;
    }

    navigator.clipboard
      .writeText(shareUrl)
      .then(() => setCopyState("copied"))
      .catch(() => setCopyState("unavailable"));
  }

  return (
    <div className="hb-local-brief__actions mt-3 border-t border-slate-200 pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border border-hb-teal/40 bg-white px-3 py-2 text-xs font-bold text-hb-navy transition hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-hb-aqua/60"
          onClick={copyLink}
          type="button"
        >
          Copy link
        </button>
        {allowPrint && (
          <button
            className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-hb-navy transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hb-aqua/60"
            onClick={() => window.print()}
            type="button"
          >
            Print brief
          </button>
        )}
      </div>
      {copyState !== "idle" && (
        <p className="mt-2 text-xs font-semibold text-hb-muted" role="status">
          {copyState === "copied"
            ? "Link copied."
            : "Link copy is unavailable in this browser."}
        </p>
      )}
    </div>
  );
}

function getTownContextCounts(record: TownTractScreeningContext) {
  return record.dataQuality.hasPrimaryAssignedTracts
    ? record.tractContext.screeningStateCountsForPrimaryAssignedTracts
    : record.tractContext.screeningStateCountsForIntersectingTracts;
}

function PublicRecordDownloads({
  countyFips,
  geoid,
  kind,
  record
}: {
  countyFips: string;
  geoid: string;
  kind: "town" | "tract";
  record: TownTractScreeningContext | TractPublicRecord;
}) {
  const label = kind === "town" ? "town context" : "tract record";

  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <p className="text-xs font-semibold text-hb-muted">Raw data files</p>
      <p className="mt-2 text-xs leading-5 text-hb-muted">
        {kind === "town"
          ? "This is tract screening context for the selected town. It does not classify the town."
          : "This is the validated public screening record for the selected census tract."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded border border-hb-teal/40 px-3 py-2 text-xs font-bold text-hb-navy hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-hb-aqua/60"
          onClick={() =>
            downloadJsonRecord(`careatlas-${kind}-${geoid}.json`, record)
          }
          type="button"
        >
          Download this {label} JSON
        </button>
        {kind === "tract" && (
          <a
            className="rounded border border-slate-300 px-3 py-2 text-xs font-bold text-hb-navy hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hb-aqua/60"
            download
            href={`/data/tracts/nj/public-records/tracts/by-county/${countyFips}.csv`}
          >
            Download county tract CSV
          </a>
        )}
        <a
          className="rounded border border-slate-300 px-3 py-2 text-xs font-bold text-hb-navy hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hb-aqua/60"
          download
          href="/data/tracts/nj/public-records/reports/new-jersey-access-gap-report.md"
        >
          Download statewide report
        </a>
      </div>
    </div>
  );
}

function CountyRecordDownloads() {
  return (
    <details className="mt-5 border-t border-slate-200 pt-3">
      <summary className="cursor-pointer text-xs font-medium text-hb-muted underline decoration-slate-300 underline-offset-2 transition hover:text-hb-navy">
        Technical details
      </summary>
      <p className="mt-3 text-xs font-semibold text-hb-muted">Raw data files</p>
      <p className="mt-2 text-xs leading-5 text-hb-muted">
        County files contain generated counts from validated tract records, not
        a score or ranking.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          className="rounded border border-hb-teal/40 px-3 py-2 text-xs font-bold text-hb-navy hover:bg-cyan-50"
          download
          href="/data/tracts/nj/public-records/counties/new-jersey-counties.json"
        >
          Download county JSON
        </a>
        <a
          className="rounded border border-slate-300 px-3 py-2 text-xs font-bold text-hb-navy hover:bg-slate-50"
          download
          href="/data/tracts/nj/public-records/counties/new-jersey-counties.csv"
        >
          Download county CSV
        </a>
      </div>
    </details>
  );
}

function formatOrdinal(value: number) {
  const remainder = value % 100;
  const suffix =
    remainder >= 11 && remainder <= 13
      ? "th"
      : value % 10 === 1
        ? "st"
        : value % 10 === 2
          ? "nd"
          : value % 10 === 3
            ? "rd"
            : "th";
  return `${value}${suffix}`;
}

function formatRuleValue(input: TractPublicRuleInput) {
  if (input.value === null) return "Not available";
  if (input.unit === "percent") return `${input.value.toFixed(1)}%`;
  if (input.unit === "percentile_rank_0_to_1") {
    return `${formatOrdinal(Math.round(input.value * 100))} New Jersey percentile`;
  }
  if (input.unit === "active_designations") {
    return `${input.value} active designation${input.value === 1 ? "" : "s"}`;
  }
  return `${input.value} ${input.unit.replaceAll("_", " ")}`;
}

function getPlainStatus(record: TractPublicRecord) {
  if (record.screening.state === "insufficient_evidence") {
    return "Not enough information to determine a gap";
  }
  return getTractClassificationVisual(record.screening.state).label;
}

function getRelevantInputs(record: TractPublicRecord) {
  const available = record.screening.ruleInputs.filter((input) => !input.missing);
  const shortageInputs = available.filter(
    (input) => input.measureId.includes("hpsa") || input.measureId.includes("muap")
  );
  const triggeredNeedInputs = available.filter(
    (input) => input.triggered && !shortageInputs.includes(input)
  );
  const prioritized = [...triggeredNeedInputs.slice(0, 3)];

  if (
    record.screening.state === "potential_access_gap" ||
    record.screening.state === "elevated_need_without_documented_shortage"
  ) {
    const shortageInput =
      shortageInputs.find((input) => input.triggered) ?? shortageInputs[0];
    if (shortageInput) prioritized.push(shortageInput);
  }

  for (const input of available) {
    if (prioritized.length >= 4) break;
    if (!prioritized.includes(input)) prioritized.push(input);
  }

  return prioritized.slice(0, 4);
}

function NearbyFacilityContext({
  loadState,
  proximity
}: {
  loadState: HealthcareFacilitiesLoadState;
  proximity: TractFacilityProximity | null;
}) {
  const nearest = proximity?.nearestCenters[0] ?? null;
  const additionalCenters = proximity?.nearestCenters.slice(1) ?? [];

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-hb-muted">
          Nearby source-backed care
        </h3>
        <DataQualityFlag label="Explain nearby facility limitations">
          These counts include loaded source-backed New Jersey HRSA community
          health centers, not every healthcare provider. Distances are straight
          lines from the official Census tract reference point, not road or
          travel distances. Proximity does not confirm services, appointment
          capacity, affordability, insurance access, transportation access or
          medical quality, and it does not change the tract&apos;s gap status.
        </DataQualityFlag>
      </div>

      {(loadState === "idle" || loadState === "loading") && (
        <p className="mt-2 text-sm text-hb-muted">
          Loading nearby healthcare centers...
        </p>
      )}
      {loadState === "error" && (
        <p className="mt-2 text-sm text-rose-700">
          Nearby healthcare-center context could not be loaded.
        </p>
      )}
      {loadState === "ready" && nearest && proximity && (
        <>
          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-hb-muted">
              Nearest known safety-net center
            </p>
            <p className="mt-1 text-sm font-semibold leading-5 text-hb-deepNavy">
              {nearest.facility.name}
            </p>
            <p className="mt-1 text-xs leading-4 text-slate-600">
              {nearest.distanceMiles.toFixed(2)} straight-line miles from the
              tract reference point
            </p>
            <HealthcareFacilityContactLinks facility={nearest.facility} />
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-700">
            {proximity.withinFiveMiles} known center
            {proximity.withinFiveMiles === 1 ? "" : "s"} within 5 miles
            {" · "}
            {proximity.withinTenMiles} within 10 miles
          </p>
          {additionalCenters.length > 0 && (
            <details className="mt-3 rounded-md border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold text-hb-navy">
                See {additionalCenters.length} more nearest center
                {additionalCenters.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-3 divide-y divide-slate-200">
                {additionalCenters.map((center) => (
                  <li className="py-2 first:pt-0 last:pb-0" key={center.facility.id}>
                    <p className="text-sm font-semibold leading-5 text-hb-deepNavy">
                      {center.facility.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      {center.distanceMiles.toFixed(2)} straight-line miles
                    </p>
                    <HealthcareFacilityContactLinks compact facility={center.facility} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {loadState === "ready" && !nearest && (
        <p className="mt-2 text-sm leading-5 text-slate-700">
          No mappable source-backed HRSA center is loaded. This does not mean
          the area has no healthcare.
        </p>
      )}
    </section>
  );
}

function TractDetails({
  backLabel,
  error,
  facilities,
  facilityLoadState,
  loadState,
  onBackToSummary,
  record
}: {
  backLabel: string;
  error: string | null;
  facilities: HealthcareFacility[];
  facilityLoadState: HealthcareFacilitiesLoadState;
  loadState: "idle" | "loading" | "ready" | "error";
  onBackToSummary: () => void;
  record: TractPublicRecord | null;
}) {
  const facilityProximity = useMemo(
    () =>
      record?.screening.state === "potential_access_gap"
        ? getTractFacilityProximity(
            record.geography.officialInternalPoint,
            facilities
          )
        : null,
    [facilities, record]
  );

  if (loadState === "loading" || loadState === "idle") {
    return <p className="mt-3 text-sm text-hb-muted">Loading this area’s gap data...</p>;
  }

  if (!record || loadState === "error") {
    return (
      <div className="mt-3">
        <p className="text-sm text-rose-700">{error ?? "This area’s gap data could not be loaded."}</p>
        <button className="mt-3 text-sm font-semibold text-hb-navy underline" onClick={onBackToSummary} type="button">
          Back to {backLabel} summary
        </button>
      </div>
    );
  }

  const relevantInputs = getRelevantInputs(record);
  const missingCount = record.screening.findings.missingRequiredMeasureIds.length;

  return (
    <>
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-hb-muted">Gap status</p>
        <p className="mt-1 text-base font-semibold leading-snug text-hb-deepNavy">{getPlainStatus(record)}</p>
      </div>

      <TractResultExplanation record={record} />
      <TractSourceSummary record={record} />

      <section className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-hb-muted">Data related to this result</h3>
          {missingCount > 0 && (
            <DataQualityFlag label="Explain missing data">
              {missingCount} required value{missingCount === 1 ? " is" : "s are"} missing for this tract. Missing values were kept unknown and did not count as zero or as reassuring evidence.
            </DataQualityFlag>
          )}
        </div>
        <dl className="mt-2 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white px-3">
          {relevantInputs.map((input) => (
            <div className="py-2" key={input.measureId}>
              <dt className="text-xs leading-4 text-hb-muted">{input.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-hb-deepNavy">{formatRuleValue(input)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {record.screening.state === "potential_access_gap" && (
        <NearbyFacilityContext
          loadState={facilityLoadState}
          proximity={facilityProximity}
        />
      )}

      <GapDriverContext record={record} />
      <ActionPaths record={record} />

      <details className="mt-4 rounded-md border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-hb-navy">See full evidence and sources</summary>
        <div className="mt-3 space-y-4 text-xs leading-5 text-slate-700">
          <section>
            <h4 className="font-bold text-hb-deepNavy">All screening values</h4>
            <ul className="mt-1 space-y-2">
              {record.screening.ruleInputs.map((input) => (
                <li key={input.measureId}>
                  <span className="font-semibold">{input.label}:</span> {formatRuleValue(input)}. Threshold {input.operator} {input.unit === "percentile_rank_0_to_1" ? formatOrdinal(Math.round(input.threshold * 100)) + " percentile" : input.unit === "percent" ? input.threshold.toFixed(1) + "%" : input.threshold}. {input.triggered === true ? "Threshold met." : input.triggered === false ? "Threshold not met." : "Result unavailable."}
                  {input.source?.url && (
                    <> <a className="font-semibold text-hb-navy underline" href={input.source.url} rel="noreferrer" target="_blank">Source</a></>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="font-bold text-hb-deepNavy">Sources</h4>
            <ul className="mt-1 space-y-1">
              {record.sources.map((source) => (
                <li key={`${source.agency}-${source.dataset}`}>
                  {source.url ? (
                    <a className="font-semibold text-hb-navy underline" href={source.url} rel="noreferrer" target="_blank">{source.agency}: {source.dataset}</a>
                  ) : (
                    `${source.agency}: ${source.dataset}`
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="font-bold text-hb-deepNavy">Important limits</h4>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {record.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
            </ul>
          </section>
        </div>

        <PublicRecordDownloads
          countyFips={record.geography.countyFips}
          geoid={record.geography.geoid}
          kind="tract"
          record={record}
        />
      </details>

      <button className="mt-4 text-sm font-semibold text-hb-navy underline" onClick={onBackToSummary} type="button">
        Back to {backLabel} summary
      </button>
    </>
  );
}

function TownDetails({
  error,
  loadState,
  onCloseTractMode,
  onOpenTractMode,
  onSelectFlaggedTract,
  record,
  tractGeoids,
  tractMode
}: {
  error: string | null;
  loadState: "idle" | "loading" | "ready" | "error";
  onCloseTractMode: () => void;
  onOpenTractMode: () => void;
  onSelectFlaggedTract: (geoid: string) => void;
  record: TownTractScreeningContext | null;
  tractGeoids: string[];
  tractMode: boolean;
}) {
  if (loadState === "loading" || loadState === "idle") {
    return (
      <p className="mt-3 text-sm text-hb-muted">
        Loading this town&apos;s gap context...
      </p>
    );
  }

  if (!record || loadState === "error") {
    return (
      <p role="alert" className="mt-3 text-sm text-rose-700">
        {error ?? "This town's gap context could not be loaded."}
      </p>
    );
  }

  const usesPrimaryAssignment = record.dataQuality.hasPrimaryAssignedTracts;
  const counts = getTownContextCounts(record);
  const totalTracts = usesPrimaryAssignment
    ? record.tractContext.primaryAssignedTractCount
    : record.tractContext.intersectingTractCount;
  const contextLabel = usesPrimaryAssignment
    ? "assigned to"
    : "overlapping";
  const insufficientCount = counts.insufficient_evidence;
  const hasGapTracts = counts.potential_access_gap > 0;
  const showDataQualityFlag =
    !usesPrimaryAssignment ||
    record.dataQuality.requiresPartialTractExplanation ||
    record.dataQuality.hasInsufficientEvidence;

  return (
    <>
      <div className="mt-3 rounded-md border border-fuchsia-200 bg-fuchsia-50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-fuchsia-800">
          Potential gap tract areas
        </p>
        <p className="mt-1 text-base font-semibold leading-snug text-hb-deepNavy">
          {counts.potential_access_gap} of the {totalTracts} census tract{totalTracts === 1 ? "" : "s"} {contextLabel} {record.geography.name}
          {totalTracts === 1 ? " was" : " were"} flagged
        </p>
      </div>

      <section className="mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-hb-muted">
          Why
        </h3>
        <p className="mt-1 text-sm leading-5 text-slate-700">
          {hasGapTracts ? (
            <>
              Flagged tract areas combine elevated health need or social
              barriers with a documented primary-care shortage.
            </>
          ) : (
            <>
              None of these tract areas met both parts of the screening rule:
              elevated health need or social barriers and a documented
              primary-care shortage.
            </>
          )}{" "}
          This is tract-level context and does not label the entire town as a
          gap or prove that access is adequate.
        </p>
      </section>

      <section className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-hb-muted">
            Data related to the gap
          </h3>
          {showDataQualityFlag && (
            <DataQualityFlag label="Explain town data limitations">
              <div className="space-y-2">
                {!usesPrimaryAssignment && (
                  <p>
                    No census tract is primarily assigned to this town. These
                    counts come from intersecting tract areas and may also
                    appear in neighboring towns.
                  </p>
                )}
                {record.dataQuality.requiresPartialTractExplanation &&
                  usesPrimaryAssignment && (
                    <p>
                      Some related census tracts cross town boundaries. Primary
                      counts prevent double counting; intersecting counts are
                      supporting context and are not population shares.
                    </p>
                  )}
                {insufficientCount > 0 && (
                  <p>
                    {insufficientCount} related tract area
                    {insufficientCount === 1 ? " has" : "s have"} missing
                    required evidence. Missing values remain unknown and were
                    not guessed.
                  </p>
                )}
              </div>
            </DataQualityFlag>
          )}
        </div>
        <p className="mt-2 text-sm leading-5 text-slate-700">
          {counts.elevated_need_without_documented_shortage} additional census tract
          {counts.elevated_need_without_documented_shortage === 1
            ? " shows"
            : "s show"} elevated need or barriers without a matching shortage
          designation.
        </p>
      </section>

      {hasGapTracts && (
        <TownFlaggedTractList
          countyFips={record.geography.countyFips}
          onSelectTract={onSelectFlaggedTract}
          tractGeoids={tractGeoids}
          usesPrimaryAssignment={usesPrimaryAssignment}
        />
      )}

      <details className="mt-4 rounded-md border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-hb-navy">
          See how town context is calculated
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-5 text-slate-700">
          <p>
            The technical term “primary-assigned” means a tract is assigned using its official Census internal
            point. That gives each tract one primary town and avoids double
            counting.
          </p>
          <p>
            Intersecting counts include meaningful partial tract overlaps, so
            the same tract can provide context for more than one town. Polygon
            overlap is not a population estimate.
          </p>
          <p>
            The town itself is never assigned an access-gap classification from
            these counts.
          </p>
        </div>

        <PublicRecordDownloads
          countyFips={record.geography.countyFips}
          geoid={record.geography.geoid}
          kind="town"
          record={record}
        />
      </details>

      {(hasGapTracts || tractMode) && (
        <button
          className="mt-4 w-full rounded-md bg-hb-navy px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-hb-deepNavy focus:outline-none focus:ring-2 focus:ring-hb-aqua/60"
          onClick={tractMode ? onCloseTractMode : onOpenTractMode}
          type="button"
        >
          {tractMode ? "Close gap tracts" : "View gap tracts"}
        </button>
      )}
      {tractMode && (
        <p className="mt-2 text-xs leading-4 text-hb-muted">
          The light grid shows census tract portions inside this town. Purple
          portions are the town's validated potential-gap tract context. Tract
          drawing stops at the town outline, while a selected evidence record
          still describes the full official census tract.
        </p>
      )}
    </>
  );
}

export function SelectedAreaCard({
  activeTractCounty,
  activeTractTown,
  facilities,
  facilityLoadState,
  onBackToSummary,
  onClear,
  onCloseTractMode,
  onOpenTractMode,
  onSelectFlaggedTract,
  selectedGeography,
  tractMode
}: SelectedAreaCardProps) {
  const displayedCounty = activeTractCounty ?? (selectedGeography?.level === "counties" ? selectedGeography : null);
  const countySummary = useCountyGapSummary(displayedCounty?.countyFips ?? null);
  const tractRecord = useTractPublicRecord(selectedGeography?.level === "tracts" ? selectedGeography.geoid ?? null : null);
  const selectedTown = selectedGeography?.level === "towns" ? selectedGeography : null;
  const townContext = useTownGapContext(
    selectedTown?.countyFips ?? null,
    selectedTown?.geoid ?? null
  );

  if (!selectedGeography && !displayedCounty) return null;

  const showingTract = tractMode && selectedGeography?.level === "tracts";
  const showingTown = selectedGeography?.level === "towns";
  const headingGeography = showingTract
    ? selectedGeography
    : showingTown
      ? selectedGeography
      : displayedCounty ?? selectedGeography;
  if (!headingGeography) return null;
  const officialId = getSelectedGeographyOfficialId(headingGeography);
  const levelLabel = getSelectedGeographyLevelLabel(headingGeography.level);
  const counts = countySummary.counts;
  const totalTracts = counts
    ? Object.values(counts).reduce((sum, count) => sum + count, 0)
    : 0;
  const allowPrintBrief = showingTract
    ? tractRecord.record !== null
    : showingTown
      ? townContext.record !== null
      : counts !== null;

  return (
    <div
      role="region"
      aria-labelledby="local-access-context-heading"
      className="hb-local-brief relative overflow-x-hidden border-t border-slate-200 bg-white"
    >
      <div className="relative p-4 pr-12">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-hb-teal" />
          <p className="text-xs font-medium text-hb-muted">
            Local access context for selected {levelLabel.toLowerCase()}
          </p>
        </div>
        <h2
          className="mt-2 text-lg font-semibold leading-tight text-hb-deepNavy"
          id="local-access-context-heading"
        >
          {headingGeography.name}
        </h2>
        {officialId && <details className="mt-1 text-xs text-hb-muted"><summary className="cursor-pointer">Area identifier</summary><p>New Jersey · Official boundary ID {officialId}</p></details>}
        <BriefActions
          allowPrint={allowPrintBrief}
          geography={headingGeography}
        />

        {showingTract ? (
          <TractDetails
            backLabel={activeTractTown ? "town" : "county"}
            error={tractRecord.error}
            facilities={facilities}
            facilityLoadState={facilityLoadState}
            loadState={tractRecord.loadState}
            onBackToSummary={onBackToSummary}
            record={tractRecord.record}
          />
        ) : showingTown ? (
          <TownDetails
            error={townContext.error}
            loadState={townContext.loadState}
            onCloseTractMode={onCloseTractMode}
            onOpenTractMode={() => onOpenTractMode(selectedGeography)}
            onSelectFlaggedTract={(geoid) =>
              onSelectFlaggedTract(selectedGeography, geoid)
            }
            record={townContext.record}
            tractGeoids={townContext.tractGeoids}
            tractMode={tractMode}
          />
        ) : displayedCounty ? (
          <>
            {countySummary.loadState === "loading" && <p className="mt-3 text-sm text-hb-muted">Loading county gap summary...</p>}
            {countySummary.loadState === "error" && <p role="alert" className="mt-3 text-sm text-rose-700">{countySummary.error}</p>}
            {counts && (
              <>
                <div className="mt-3 rounded-md border border-fuchsia-200 bg-fuchsia-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-fuchsia-800">Potential gap areas</p>
                  <p className="mt-1 text-base font-semibold text-hb-deepNavy">{counts.potential_access_gap} of {totalTracts} census tracts were flagged</p>
                </div>
                <section className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-hb-muted">Why</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-700">These smaller areas combine elevated health need or social barriers with a documented primary-care shortage.</p>
                </section>
                <section className="mt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-hb-muted">Data related to the gap</h3>
                    {counts.insufficient_evidence > 0 && (
                      <DataQualityFlag label="Explain county data limitations">
                        {counts.insufficient_evidence} tract{counts.insufficient_evidence === 1 ? " has" : "s have"} missing required data. Those areas were marked separately and were not guessed.
                      </DataQualityFlag>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{counts.elevated_need_without_documented_shortage} additional tract{counts.elevated_need_without_documented_shortage === 1 ? " shows" : "s show"} elevated need or barriers without a matching shortage designation.</p>
                </section>
              </>
            )}
            <button
              className="mt-4 w-full rounded-md bg-hb-navy px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-hb-deepNavy focus:outline-none focus:ring-2 focus:ring-hb-aqua/60"
              onClick={() => tractMode ? onCloseTractMode() : onOpenTractMode(displayedCounty)}
              type="button"
            >
              {tractMode ? "Close gap areas" : "View gap areas"}
            </button>
            {tractMode && <p className="mt-2 text-xs leading-4 text-hb-muted">The dark labeled outline is this county's unchanged boundary. Tract drawing is clipped to that exact outline, so no colored tract appears outside it. Purple areas met the potential-gap screening rule; light tract areas remain selectable for their own result.</p>}
            <CountyRecordDownloads />
          </>
        ) : null}

        <button
          aria-label="Clear selected area"
          className="hb-local-brief__close absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-hb-teal/20 bg-white/80 text-lg font-semibold leading-none text-hb-navy shadow-sm transition hover:border-hb-teal/45 hover:bg-hb-aqua/[0.12] hover:text-hb-deepNavy focus:outline-none focus:ring-2 focus:ring-hb-aqua/45"
          onClick={tractMode ? onCloseTractMode : onClear}
          type="button"
        >
          ×
        </button>
      </div>
    </div>
  );
}
