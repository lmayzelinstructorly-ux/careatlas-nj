import { lazy, Suspense, useEffect, useState } from "react";
import PublicHeader from "../components/PublicHeader";
import type { MapMode } from "../types";

const CareAtlasMap = lazy(() => import("../components/CareAtlasMap"));

function MapPage() {
  const [mapMode, setMapMode] = useState<MapMode>(() => {
    const parameters = new URLSearchParams(window.location.search);
    const hasSelectedArea =
      /^34\d{3}$/.test(parameters.get("county") ?? "") ||
      /^34\d{8}$/.test(parameters.get("town") ?? "") ||
      /^34\d{9}$/.test(parameters.get("tract") ?? "");
    if (parameters.get("mode") === "gaps" || hasSelectedArea) return "gaps";
    return parameters.get("mode") === "doctor-offices"
      ? "doctor_offices"
      : parameters.get("mode") === "healthcare" ? "healthcare" : "gaps";
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (mapMode === "gaps") url.searchParams.set("mode", "gaps");
    else if (mapMode === "doctor_offices") {
      url.searchParams.set("mode", "doctor-offices");
    } else url.searchParams.set("mode", "healthcare");
    window.history.replaceState(window.history.state, "", url);
  }, [mapMode]);

  return (
    <main className="flex h-screen h-[100dvh] min-h-[36rem] flex-col overflow-hidden bg-[#f2f5f5] text-hb-text">
      <PublicHeader mapMode={mapMode} onMapModeChange={setMapMode} />
      <div className="min-h-0 flex-1 p-1.5 sm:p-2">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-white text-sm font-semibold text-hb-muted">
              Loading New Jersey map...
            </div>
          }
        >
          <CareAtlasMap mapMode={mapMode} />
        </Suspense>
      </div>
    </main>
  );
}

export default MapPage;
