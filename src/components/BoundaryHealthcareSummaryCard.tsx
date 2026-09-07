import type { ReactNode } from "react";
import type {
  BoundaryHealthcareSummary,
  BoundaryHealthcareSummaryLevel,
  BoundaryHealthcareSummaryLoadState,
  BoundaryHealthcareSummaryLookup
} from "../utils/boundaryHealthcareSummary";

type Props = {
  loadState: BoundaryHealthcareSummaryLoadState;
  lookup: BoundaryHealthcareSummaryLookup;
  onFacilitySelect: (facilityId: string) => void;
  onLoadRequest: () => void;
};

const levelLabels: Record<BoundaryHealthcareSummaryLevel, string> = {
  county: "County",
  local_jurisdiction: "Local jurisdiction",
  state: "State"
};

function Summary({ summary, isPolicy }: { summary: BoundaryHealthcareSummary; isPolicy: boolean }) {
  const typeMix = Object.entries(summary.facilityTypeCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <section className="border-l-2 border-slate-200 pl-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold text-hb-teal">Area evidence</p><h2 className="mt-1 text-base font-semibold text-hb-deepNavy">{summary.boundaryName}</h2><p className="mt-1 text-[11px] font-bold text-hb-muted">Boundary ID {summary.boundaryId}</p></div>
        <span className="rounded border border-hb-aqua/35 px-2 py-1 text-[11px] font-semibold text-hb-navy">{levelLabels[summary.boundaryLevel]}</span>
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-hb-muted">
        {summary.totalAssignedFacilities === 0
          ? "No source-backed facilities are assigned to this area in the currently loaded data. This does not mean the area has no healthcare."
          : `${summary.totalAssignedFacilities} source-backed facility records are assigned to this area.`}
      </p>
      {isPolicy && <p className="mt-3 rounded border border-hb-border bg-hb-background p-3 text-xs font-semibold text-hb-muted">Detailed assignments are not loaded for this supported boundary yet.</p>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded border border-hb-border bg-hb-background p-3"><p className="text-[11px] font-semibold uppercase text-hb-teal">Assigned records</p><p className="mt-1 text-2xl font-bold text-hb-deepNavy">{summary.totalAssignedFacilities}</p></div>
        <div className="rounded border border-hb-border bg-hb-background p-3"><p className="text-[11px] font-semibold uppercase text-hb-teal">With coordinates</p><p className="mt-1 text-2xl font-bold text-hb-deepNavy">{summary.facilitiesWithValidCoordinates}</p></div>
      </div>

      {typeMix.length > 0 && <div className="mt-4"><h3 className="text-xs font-semibold text-hb-deepNavy">Facility types</h3><div className="mt-2 flex flex-wrap gap-2">{typeMix.map(([type, count]) => <span className="rounded border border-hb-border bg-hb-background px-2 py-1 text-[11px] font-semibold text-hb-muted" key={type}>{type.replaceAll("_", " ")}: {count}</span>)}</div></div>}

      {summary.missingDataWarnings.length > 0 && <div className="mt-4 rounded border border-hb-border bg-hb-background p-3"><h3 className="text-xs font-semibold text-hb-deepNavy">Missing-data warnings</h3><ul className="mt-2 space-y-1 text-xs leading-5 text-hb-muted">{summary.missingDataWarnings.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {summary.dataCompletenessNotes.length > 0 && <div className="mt-4"><h3 className="text-xs font-semibold text-hb-deepNavy">Data notes</h3><ul className="mt-2 space-y-1 text-xs leading-5 text-hb-muted">{summary.dataCompletenessNotes.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {summary.sourceCoverageNotes[0] && <p className="mt-4 border-t border-hb-border pt-3 text-[11px] leading-5 text-hb-muted">{summary.sourceCoverageNotes[0]}</p>}
      <p className="mt-2 text-[11px] leading-5 text-hb-muted">Hospitals are shown as documented facilities and are not automatically counted as primary-care capacity.</p>
      <p className="mt-2 text-[11px] font-semibold leading-5 text-hb-muted">Open a facility record for its source, dates, contact details and missing fields.</p>
    </section>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-l-2 border-slate-200 pl-4"><p className="text-xs font-semibold text-hb-teal">Area evidence</p><h2 className="mt-1 text-base font-semibold text-hb-deepNavy">{title}</h2><div className="mt-3 text-sm font-semibold leading-6 text-hb-muted">{children}</div></section>;
}

function BoundaryHealthcareSummaryCard({ loadState, lookup, onLoadRequest }: Props) {
  if (lookup.kind === "not_selected") return <Message title="Area summary">Select a state, county or local jurisdiction to review loaded facility evidence.</Message>;
  if (lookup.kind === "tract_foundation") return <Message title="New Jersey tract foundation">Official tract boundary {lookup.boundaryId ?? "selected"} is available. Facility assignments are kept separate by HRSA health center and CMS hospital type; community health, social-barrier and shortage evidence are not loaded yet, so CareAtlas does not calculate an access-gap flag.</Message>;
  if (lookup.kind === "missing_stable_id") return <Message title="Summary unavailable">This boundary does not have the stable official ID required for a safe data join.</Message>;
  if (loadState === "idle") return <Message title="Area evidence available"><button className="rounded border border-hb-border bg-hb-background px-3 py-2 text-xs font-semibold" onClick={onLoadRequest} type="button">Load area evidence</button></Message>;
  if (loadState === "loading") return <Message title="Loading area evidence">Loading documented facility assignments...</Message>;
  if (loadState === "error" || lookup.kind === "unavailable") return <Message title="Area evidence unavailable">The boundary map remains available, but its facility summary could not be loaded.</Message>;
  return <Summary isPolicy={lookup.kind === "no_assigned_policy"} summary={lookup.summary} />;
}

export default BoundaryHealthcareSummaryCard;
