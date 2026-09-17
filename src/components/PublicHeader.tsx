import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import type { MapMode } from "../types";
import { MethodologyGuide } from "./MethodologyGuide";
import { SiteBrand } from "./SiteBrand";

type Props = {
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
};

function PublicHeader({ mapMode, onMapModeChange }: Props) {
  const [isMethodologyGuideOpen, setIsMethodologyGuideOpen] = useState(false);
  const closeMethodologyGuide = useCallback(
    () => setIsMethodologyGuideOpen(false),
    []
  );

  return (
    <>
      <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white/95 px-3 py-1.5 shadow-[0_2px_10px_rgba(23,49,61,0.06)] backdrop-blur sm:px-5 sm:py-2">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 sm:gap-3 lg:flex-nowrap">
          <div className="hb-map-brand flex min-w-0 items-center">
            <SiteBrand />
          </div>
          <div
            aria-label="Choose map mode"
            className="order-last grid w-full grid-cols-3 items-stretch rounded-lg border border-hb-border bg-slate-100 p-1 lg:order-none lg:w-auto"
            role="group"
          >
            <button
              aria-pressed={mapMode === "healthcare"}
              className={`rounded-md px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
                mapMode === "healthcare"
                  ? "bg-hb-navy text-white shadow-sm"
                  : "text-hb-muted hover:bg-white hover:text-hb-deepNavy"
              }`}
              onClick={() => onMapModeChange("healthcare")}
              type="button"
            >
              Hospitals &amp; community health centers
            </button>
            <button
              aria-pressed={mapMode === "doctor_offices"}
              className={`rounded-md px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
                mapMode === "doctor_offices"
                  ? "bg-hb-navy text-white shadow-sm"
                  : "text-hb-muted hover:bg-white hover:text-hb-deepNavy"
              }`}
              onClick={() => onMapModeChange("doctor_offices")}
              type="button"
            >
              Doctor offices (pilot)
            </button>
            <button
              aria-pressed={mapMode === "gaps"}
              className={`rounded-md px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
                mapMode === "gaps"
                  ? "bg-hb-navy text-white shadow-sm"
                  : "text-hb-muted hover:bg-white hover:text-hb-deepNavy"
              }`}
              onClick={() => onMapModeChange("gaps")}
              type="button"
            >
              Potential gaps
            </button>
          </div>
          <Link
            aria-label="Build story: project decisions and process"
            className="inline-flex shrink-0 items-center rounded-lg border border-hb-border bg-white px-3 py-2 text-xs font-bold text-hb-deepNavy shadow-sm transition hover:border-hb-teal hover:text-hb-teal focus:outline-none focus:ring-2 focus:ring-hb-aqua sm:px-4 sm:text-sm"
            to="/story"
          >
            Project story
          </Link>
          {mapMode === "gaps" && (
            <button
              className="group inline-flex shrink-0 items-center gap-2 rounded-lg border border-hb-border bg-slate-50/80 px-3 py-2 text-xs font-bold text-hb-deepNavy shadow-sm transition hover:border-hb-teal hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-hb-aqua sm:px-4 sm:text-sm"
              onClick={() => setIsMethodologyGuideOpen(true)}
              type="button"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-hb-teal shadow-[0_0_0_3px_rgba(15,118,110,0.12)] transition group-hover:bg-hb-aqua"
              />
              How gaps are found
            </button>
          )}
        </div>
      </header>
      <MethodologyGuide
        isOpen={isMethodologyGuideOpen}
        onClose={closeMethodologyGuide}
      />
    </>
  );
}

export default PublicHeader;
