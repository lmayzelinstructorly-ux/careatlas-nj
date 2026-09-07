import type { TractEvidenceObservation } from "../types/tractEvidence";
import type {
  TractPublicFacility,
  TractPublicRecord,
  TractPublicRecordLoadState,
  TractPublicRuleInput
} from "../types/tractPublicRecord";
import {
  createPhoneHref,
  getFacilityPhoneDisplay
} from "../utils/healthcareFacilityContact";
import { getTractClassificationVisual } from "../utils/tractClassification";

type Props = {
  error: string | null;
  loadState: TractPublicRecordLoadState;
  record: TractPublicRecord | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeZone: "UTC"
      }).format(date);
}

function formatValue(value: unknown, unit: string) {
  if (value === null || value === undefined) return "Unavailable";
  if (unit === "percent") return `${value}%`;
  if (unit === "percentile_rank_0_to_1") return `${value} (0 to 1 rank)`;
  if (unit === "active_designations") {
    return `${value} active designation${value === 1 ? "" : "s"}`;
  }
  return `${value} ${unit.replaceAll("_", " ")}`;
}

function formatOperator(operator: TractPublicRuleInput["operator"]) {
  return operator === ">=" ? "at or above" : "at or below";
}

function normalizeWebsite(value: string | null) {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function SourceLine({ observation }: { observation: TractEvidenceObservation }) {
  return (
    <p className="mt-2 text-xs leading-5 text-hb-muted">
      {observation.source.agency} · {observation.source.dataset} · release {observation.source.releaseYear} · checked {formatDate(observation.provenance.checkedDate)} · {observation.estimateType}
      {observation.source.url && (
        <>
          {" · "}
          <a className="font-semibold text-hb-teal underline" href={observation.source.url} rel="noreferrer" target="_blank">
            Official source
          </a>
        </>
      )}
    </p>
  );
}

function ObservationList({ observations }: { observations: TractEvidenceObservation[] }) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {observations.map((observation) => (
        <article className="rounded border border-slate-200 bg-slate-50 p-3" key={observation.measure.id}>
          <h4 className="text-sm font-semibold text-hb-deepNavy">{observation.measure.label}</h4>
          <p className={`mt-1 text-lg font-bold ${observation.missingness.isMissing ? "text-slate-600" : "text-hb-navy"}`}>
            {formatValue(observation.value, observation.unit)}
          </p>
          {observation.missingness.isMissing && (
            <p className="mt-1 text-xs font-semibold leading-5 text-rose-800">
              Missing reason: {observation.missingness.reason ?? "The source did not provide a usable value."}
            </p>
          )}
          <SourceLine observation={observation} />
          <details className="mt-2 text-xs text-hb-muted">
            <summary className="cursor-pointer font-semibold text-hb-deepNavy">Technical details</summary>
            <p className="mt-2 leading-5">Unit: {observation.unit}. Source record: {observation.provenance.sourceRecordId}.</p>
            <p className="mt-1 leading-5">{observation.provenance.transformation}</p>
          </details>
        </article>
      ))}
    </div>
  );
}

function RuleInputTable({ inputs }: { inputs: TractPublicRuleInput[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded border border-slate-200">
      <table className="min-w-[52rem] w-full border-collapse text-left text-xs">
        <thead className="bg-slate-100 text-hb-deepNavy">
          <tr>
            <th className="px-3 py-2">Required input</th>
            <th className="px-3 py-2">Value</th>
            <th className="px-3 py-2">Published threshold</th>
            <th className="px-3 py-2">Result</th>
            <th className="px-3 py-2">Source and date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {inputs.map((input) => (
            <tr key={input.measureId}>
              <td className="px-3 py-3 align-top font-semibold text-hb-deepNavy">
                {input.label}
                <span className="mt-1 block font-normal text-hb-muted">{input.estimateType}</span>
              </td>
              <td className="px-3 py-3 align-top font-semibold text-hb-navy">
                {formatValue(input.value, input.unit)}
                {input.missing && (
                  <span className="mt-1 block text-rose-800">{input.missingReason ?? "Required value is missing."}</span>
                )}
              </td>
              <td className="px-3 py-3 align-top text-hb-muted">
                {formatOperator(input.operator)} {formatValue(input.threshold, input.unit)}
                {input.meaning && <span className="mt-1 block">{input.meaning}</span>}
              </td>
              <td className="px-3 py-3 align-top">
                <span className={`inline-flex rounded border px-2 py-1 font-bold ${input.triggered === true ? "border-amber-500 bg-amber-50 text-amber-950" : input.triggered === false ? "border-slate-300 bg-slate-50 text-slate-700" : "border-dashed border-slate-500 bg-slate-100 text-slate-700"}`}>
                  {input.triggered === true ? "Triggered" : input.triggered === false ? "Did not trigger" : "Unavailable"}
                </span>
              </td>
              <td className="px-3 py-3 align-top text-hb-muted">
                {input.source?.agency ?? "Source unavailable"}
                <span className="mt-1 block">{input.source?.dataset ?? "Dataset unavailable"}</span>
                <span className="mt-1 block">Release {input.source?.releaseYear ?? "unavailable"}; checked {formatDate(input.checkedDate)}</span>
                {input.source?.url && (
                  <a className="mt-1 inline-block font-semibold text-hb-teal underline" href={input.source.url} rel="noreferrer" target="_blank">
                    Official source
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FacilityCard({ facility }: { facility: TractPublicFacility }) {
  const phoneDisplay = getFacilityPhoneDisplay(facility.phone);
  const phoneHref = createPhoneHref(facility.phone);
  const website = normalizeWebsite(facility.website);
  return (
    <article className="rounded border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-hb-teal">
        {facility.facilityType === "community_health_center" ? "HRSA community health center" : "CMS hospital"}
      </p>
      <h4 className="mt-1 text-sm font-semibold text-hb-deepNavy">{facility.name}</h4>
      <p className="mt-2 text-xs leading-5 text-hb-muted">
        {[facility.address, facility.city, facility.state, facility.postalCode].filter(Boolean).join(", ") || "Address unavailable"}
      </p>
      <p className="mt-1 text-xs leading-5 text-hb-muted">
        {phoneHref && phoneDisplay
          ? <a className="font-semibold text-hb-teal underline" href={phoneHref}>{phoneDisplay.number}{phoneDisplay.extension ? ` ext. ${phoneDisplay.extension}` : ""}</a>
          : "Phone unavailable"}
        {website && <>{" · "}<a className="font-semibold text-hb-teal underline" href={website} rel="noreferrer" target="_blank">Website</a></>}
      </p>
      <p className="mt-2 text-xs leading-5 text-hb-muted">
        {facility.source.agency} · {facility.source.dataset} · checked {formatDate(facility.source.checkedDate)}
        {facility.source.url && <>{" · "}<a className="font-semibold text-hb-teal underline" href={facility.source.url} rel="noreferrer" target="_blank">Official source</a></>}
      </p>
      {facility.missingFields.length > 0 && (
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-700">Missing fields: {facility.missingFields.join(", ")}.</p>
      )}
    </article>
  );
}

function TractEvidencePanel({ error, loadState, record }: Props) {
  if (loadState === "idle") {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-5">
        <h3 className="font-semibold text-hb-deepNavy">Select a New Jersey census tract</h3>
        <p className="mt-2 text-sm leading-6 text-hb-muted">
          Select a county to load its tract screening layer, then click a tract or search its 11-digit GEOID. CareAtlas loads only the requested county shard.
        </p>
      </div>
    );
  }
  if (loadState === "loading") {
    return <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-hb-muted">Loading the selected tract evidence record...</p>;
  }
  if (loadState === "error" || !record) {
    return <p role="alert" className="rounded border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">The tract evidence record could not be loaded. {error}</p>;
  }

  const visual = getTractClassificationVisual(record.screening.state);
  const nearest = record.documentedFacilityContext.nearestSourceBackedSafetyNetCenter;
  const countyFips = record.geography.countyFips;
  const tractJsonUrl = `/data/tracts/nj/public-records/tracts/by-county/${countyFips}.json`;
  const tractCsvUrl = `/data/tracts/nj/public-records/tracts/by-county/${countyFips}.csv`;

  return (
    <div className="space-y-6">
      <header className="rounded border border-slate-300 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-hb-teal">Census tract screening record</p>
            <h3 className="mt-1 text-2xl font-bold text-hb-deepNavy">{record.geography.name}</h3>
            <p className="mt-1 text-sm font-semibold text-hb-muted">{record.geography.countyName} · GEOID {record.geography.geoid}</p>
          </div>
          <div className={`hb-tract-state-badge ${visual.patternClass}`}>
            {record.screening.label}
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-hb-muted">{visual.shortExplanation}</p>
        <p className="mt-2 text-xs font-semibold text-hb-muted">Transparent screening rule version {record.ruleVersion}. Results are not rankings or medical diagnoses.</p>
        <p className="mt-1 text-xs font-semibold text-hb-muted">No current gap flag does not prove adequate access.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-hb-muted">
          {record.explanations.map((explanation) => <li key={explanation}>{explanation}</li>)}
        </ul>
      </header>

      <section aria-labelledby="tract-rule-inputs-heading">
        <h3 id="tract-rule-inputs-heading" className="text-lg font-semibold text-hb-deepNavy">Seven required rule inputs</h3>
        <p className="mt-1 text-sm leading-6 text-hb-muted">Each input preserves its value, unit, threshold, operator, trigger result, estimate type, source and date.</p>
        <RuleInputTable inputs={record.screening.ruleInputs} />
      </section>

      <section aria-labelledby="community-health-heading">
        <h3 id="community-health-heading" className="text-lg font-semibold text-hb-deepNavy">Community health need</h3>
        <p className="mt-1 text-sm leading-6 text-hb-muted">CDC PLACES values are modeled population estimates, not individual diagnoses.</p>
        <ObservationList observations={record.evidence.communityHealthNeed} />
      </section>

      <section aria-labelledby="social-barriers-heading">
        <h3 id="social-barriers-heading" className="text-lg font-semibold text-hb-deepNavy">Social barriers</h3>
        <p className="mt-1 text-sm leading-6 text-hb-muted">SVI values are official national percentile ranks. ACS percentages are survey-derived estimates. These measures do not prove causation.</p>
        <ObservationList observations={record.evidence.socialBarriers} />
      </section>

      <section aria-labelledby="shortage-heading">
        <h3 id="shortage-heading" className="text-lg font-semibold text-hb-deepNavy">Official shortage evidence</h3>
        <p className="mt-1 text-sm leading-6 text-hb-muted">HRSA designations can apply to a whole area, part of an area or a defined population. Primary care, dental, mental health and MUA/P remain separate.</p>
        <ObservationList observations={record.evidence.officialShortage} />
      </section>

      <section aria-labelledby="facility-context-heading" className="rounded border border-slate-200 bg-slate-50 p-4">
        <h3 id="facility-context-heading" className="text-lg font-semibold text-hb-deepNavy">Documented facility context</h3>
        <p className="mt-1 text-sm leading-6 text-hb-muted">Loaded pins are source-backed context, not a complete provider directory. Missing facility pins do not mean zero healthcare.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-slate-200 bg-white p-3"><dt className="text-xs font-semibold text-hb-muted">HRSA community health centers in tract</dt><dd className="mt-1 text-2xl font-bold text-hb-deepNavy">{record.documentedFacilityContext.countsByType.hrsaCommunityHealthCenters}</dd></div>
          <div className="rounded border border-slate-200 bg-white p-3"><dt className="text-xs font-semibold text-hb-muted">CMS hospitals in tract</dt><dd className="mt-1 text-2xl font-bold text-hb-deepNavy">{record.documentedFacilityContext.countsByType.cmsHospitals}</dd><p className="mt-1 text-xs text-hb-muted">Not counted as primary-care capacity without supporting evidence.</p></div>
        </dl>
        {record.documentedFacilityContext.loadedFacilitiesInTract.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {record.documentedFacilityContext.loadedFacilitiesInTract.map((facility) => <FacilityCard facility={facility} key={facility.id} />)}
          </div>
        )}
        {nearest && (
          <div className="mt-5 border-t border-slate-300 pt-4">
            <h4 className="font-semibold text-hb-deepNavy">Nearest loaded source-backed safety-net center</h4>
            <p className="mt-1 text-sm leading-6 text-hb-muted">{nearest.distanceMiles.toFixed(2)} straight-line miles from the official Census tract internal point.</p>
            <div className="mt-3"><FacilityCard facility={nearest.facility} /></div>
            <details className="mt-3 text-xs text-hb-muted">
              <summary className="cursor-pointer font-semibold text-hb-deepNavy">Distance method and limitations</summary>
              <p className="mt-2 leading-5">{nearest.distanceMethod.name}, Earth radius {nearest.distanceMethod.earthRadiusMiles.toLocaleString("en-US")} miles. Origin: {record.geography.officialInternalPoint.method}, checked {formatDate(record.geography.officialInternalPoint.checkedDate)}.</p>
              <p className="mt-1 leading-5">{nearest.distanceMethod.note}</p>
            </details>
          </div>
        )}
      </section>

      <section aria-labelledby="missing-limitations-heading">
        <h3 id="missing-limitations-heading" className="text-lg font-semibold text-hb-deepNavy">Missing evidence and limitations</h3>
        {record.missingEvidence.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-rose-900">
            {record.missingEvidence.map((missing) => <li key={missing.measureId}><strong>{missing.label}:</strong> {missing.reason ?? "No usable source value."}{missing.requiredByRule ? " This required missing value produces Insufficient evidence." : ""}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm leading-6 text-hb-muted">No required or context observation is marked missing for this tract.</p>}
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-hb-muted">
          {[...record.limitations, ...record.documentedFacilityContext.limitations].map((limitation) => <li key={limitation}>{limitation}</li>)}
        </ul>
      </section>

      <details className="border-t border-slate-200 pt-3">
        <summary className="cursor-pointer text-xs font-medium text-hb-muted underline decoration-slate-300 underline-offset-2 transition hover:text-hb-navy">Technical details</summary>
        <p className="mt-3 text-xs font-semibold text-hb-muted">Raw data files</p>
        <p className="mt-2 text-sm leading-6 text-hb-muted">Tract records are county-sharded to keep map loading intentional. County summaries are generated from validated tract evidence.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          <a className="rounded border border-hb-teal px-3 py-2 text-hb-teal" download href={tractJsonUrl}>This county's tract JSON</a>
          <a className="rounded border border-hb-teal px-3 py-2 text-hb-teal" download href={tractCsvUrl}>This county's tract CSV</a>
          <a className="rounded border border-slate-300 px-3 py-2 text-hb-navy" download href="/data/tracts/nj/public-records/counties/new-jersey-counties.json">County JSON</a>
          <a className="rounded border border-slate-300 px-3 py-2 text-hb-navy" download href="/data/tracts/nj/public-records/counties/new-jersey-counties.csv">County CSV</a>
          <a className="rounded border border-slate-300 px-3 py-2 text-hb-navy" download href="/data/tracts/nj/public-records/reports/new-jersey-access-gap-report.md">New Jersey report</a>
        </div>
      </details>
    </div>
  );
}

export default TractEvidencePanel;
