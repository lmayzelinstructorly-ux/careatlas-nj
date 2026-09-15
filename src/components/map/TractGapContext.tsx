import type { TractEvidenceObservation } from "../../types/tractEvidence";
import type { TractPublicRecord } from "../../types/tractPublicRecord";

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

function formatObservationValue(observation: TractEvidenceObservation) {
  if (observation.value === null) return "Not available";
  if (observation.unit === "percent" && typeof observation.value === "number") {
    return `${observation.value.toFixed(1)}%`;
  }
  if (
    observation.unit === "percentile_rank_0_to_1" &&
    typeof observation.value === "number"
  ) {
    return `${formatOrdinal(Math.round(observation.value * 100))} New Jersey percentile`;
  }
  if (
    observation.unit === "active_designations" &&
    typeof observation.value === "number"
  ) {
    return `${observation.value} active designation${observation.value === 1 ? "" : "s"}`;
  }
  return `${observation.value} ${observation.unit.replaceAll("_", " ")}`;
}

function getRecordObservations(record: TractPublicRecord) {
  return [
    ...record.evidence.communityHealthNeed,
    ...record.evidence.socialBarriers,
    ...record.evidence.officialShortage
  ];
}

export function GapDriverContext({ record }: { record: TractPublicRecord }) {
  const observationById = new Map(
    getRecordObservations(record).map((observation) => [
      observation.measure.id,
      observation
    ])
  );

  return (
    <details className="mt-4 rounded-md border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-hb-navy">
        Explore factors that may shape access
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-5 text-slate-700">
          {"These groups organize validated context. They do not diagnose a cause, add a score or change this tract's screening status."}
        </p>
        {record.gapDrivers.map((driver) => (
          <article className="rounded-md border border-slate-200 bg-slate-50 p-3" key={driver.id}>
            <h4 className="text-sm font-semibold text-hb-deepNavy">{driver.label}</h4>
            <p className="mt-1 text-xs leading-5 text-slate-700">{driver.summary}</p>
            <dl className="mt-2 space-y-1.5">
              {driver.availableMeasureIds.map((measureId) => {
                const observation = observationById.get(measureId);
                if (!observation) return null;
                return (
                  <div className="flex items-start justify-between gap-3 text-xs" key={measureId}>
                    <dt className="leading-4 text-hb-muted">{observation.measure.label}</dt>
                    <dd className="shrink-0 text-right font-semibold text-hb-deepNavy">
                      {formatObservationValue(observation)}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {driver.missingMeasureIds.length > 0 && (
              <p className="mt-2 text-[11px] leading-4 text-rose-800">
                {driver.missingMeasureIds.length} related value
                {driver.missingMeasureIds.length === 1 ? " is" : "s are"} unavailable and remain unknown.
              </p>
            )}
          </article>
        ))}
      </div>
    </details>
  );
}

export function ActionPaths({ record }: { record: TractPublicRecord }) {
  return (
    <details className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-hb-navy">
        Explore official action paths
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-5 text-slate-700">
          {"These are public programs and planning resources to investigate, not personalized recommendations or guaranteed solutions for this tract."}
        </p>
        {record.actionPaths.map((action) => (
          <article className="rounded-md border border-emerald-200 bg-white p-3" key={action.id}>
            <h4 className="text-sm font-semibold text-hb-deepNavy">{action.title}</h4>
            <p className="mt-1 text-xs leading-5 text-slate-700">{action.summary}</p>
            <a
              className="mt-2 inline-block text-sm font-semibold text-hb-navy underline"
              href={action.officialResource.url}
              rel="noreferrer"
              target="_blank"
            >
              {action.officialResource.name}
            </a>
            <p className="mt-2 text-[11px] leading-4 text-hb-muted">{action.limitation}</p>
          </article>
        ))}
      </div>
    </details>
  );
}
