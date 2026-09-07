import { useMemo } from "react";
import type {
  HealthcareFacility,
  HealthcareFacilityType
} from "../types/healthcare";
import { getHealthcareFacilityPresentation } from "../utils/healthcareFacilityPresentation";

const preferredTypeOrder: HealthcareFacilityType[] = [
  "hospital",
  "community_health_center",
  "clinic",
  "urgent_care",
  "pharmacy",
  "mental_health",
  "dental",
  "other"
];

export function HealthcareFacilityKey({
  facilities
}: {
  facilities: HealthcareFacility[];
}) {
  const typeCounts = useMemo(() => {
    const counts = new Map<HealthcareFacilityType, number>();

    facilities.forEach((facility) => {
      counts.set(facility.facilityType, (counts.get(facility.facilityType) ?? 0) + 1);
    });

    return preferredTypeOrder.flatMap((facilityType) => {
      const count = counts.get(facilityType) ?? 0;
      return count > 0 ? [{ count, facilityType }] : [];
    });
  }, [facilities]);

  return (
    <section
      aria-label="Healthcare facility pin key"
      className="absolute bottom-14 left-3 z-[1000] w-[17rem] max-w-[calc(100%-1.5rem)] rounded-lg border border-slate-300 bg-white/95 p-3 shadow-[0_10px_24px_rgb(0_43_77_/_0.16)] backdrop-blur sm:bottom-4 sm:left-4"
    >
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-hb-teal">
        What the facility pins show
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {typeCounts.map(({ count, facilityType }) => {
          const presentation = getHealthcareFacilityPresentation(facilityType);

          return (
            <div className="flex items-center gap-2" key={facilityType}>
              <span
                aria-hidden="true"
                className={`hb-healthcare-key-symbol ${presentation.markerClassName}`}
              >
                <svg
                  dangerouslySetInnerHTML={{ __html: presentation.symbolMarkup }}
                  viewBox="0 0 32 32"
                />
              </span>
              <span className="text-xs font-bold text-hb-deepNavy">
                {presentation.label} <span className="text-hb-muted">({count})</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 border-t border-slate-200 pt-2 text-[10px] leading-4 text-hb-muted">
        This source-backed layer currently includes hospitals and HRSA community health centers, not every physician office or place that may provide care.
      </p>
      <details className="mt-2 border-t border-slate-200 pt-2 text-[10px] leading-4 text-hb-muted">
        <summary className="cursor-pointer font-bold text-hb-deepNavy">
          What is a community health center?
        </summary>
        <p className="mt-1.5">
          CareAtlas uses this term for service sites operated by organizations in the federal HRSA Health Center Program, including designated Look-Alikes. They serve everyone, even if they cannot pay, and adjust fees based on income and family size.
        </p>
        <a
          className="mt-1 inline-block font-bold text-hb-teal underline decoration-hb-aqua/60 underline-offset-2 hover:text-hb-navy"
          href="https://bphc.hrsa.gov/about-health-center-program/what-health-center"
          rel="noreferrer"
          target="_blank"
        >
          Read HRSA&apos;s definition
        </a>
      </details>
    </section>
  );
}
