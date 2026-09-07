import type { BoundaryHealthcarePreview } from "./mapTypes";

export type { BoundaryHealthcarePreview };

export type BoundaryHealthcarePreviewCardProps = {
  preview: BoundaryHealthcarePreview | null;
};

export function BoundaryHealthcarePreviewCard({
  preview
}: BoundaryHealthcarePreviewCardProps) {
  if (!preview) {
    return null;
  }

  const assignedText =
    preview.totalAssignedFacilities === null
      ? "Summary unavailable"
      : `${preview.totalAssignedFacilities} mapped healthcare ${
          preview.totalAssignedFacilities === 1 ? "record" : "records"
        }`;
  const coordinateText =
    preview.coordinatesCount === null
      ? "Coordinates unavailable"
      : `${preview.coordinatesCount} with valid coordinates`;

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000] w-[min(20rem,calc(100%-1.5rem))] rounded border border-slate-300 bg-white/95 p-3 sm:right-4 sm:top-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-none text-hb-muted">
            Boundary preview
          </p>
          <h2 className="mt-1 truncate text-sm font-semibold leading-tight text-hb-deepNavy">
            {preview.boundaryName}
          </h2>
        </div>
        <span className="shrink-0 rounded-md border border-hb-aqua/25 bg-hb-background px-2 py-1 text-[10px] font-black text-hb-navy">
          {preview.levelLabel}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-hb-border bg-hb-background px-2 py-1.5">
          <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
            Assigned
          </p>
          <p className="mt-1 text-xs font-black leading-tight text-hb-deepNavy">
            {assignedText}
          </p>
        </div>
        <div className="rounded-md border border-hb-border bg-hb-background px-2 py-1.5">
          <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
            Coordinates
          </p>
          <p className="mt-1 text-xs font-black leading-tight text-hb-deepNavy">
            {preview.coordinatesCount ?? "Unavailable"}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] font-semibold leading-4 text-hb-muted">
        {coordinateText}. This is a limited mapped facility coverage view, not a
        complete provider directory.
      </p>
    </div>
  );
}
