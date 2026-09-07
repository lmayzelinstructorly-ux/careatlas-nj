import { lazy, Suspense, useState } from "react";
import { NavLink } from "react-router-dom";
import { useHealthcareFacilities } from "../hooks/useHealthcareFacilities";

const HealthcareDataQualityDashboard = lazy(
  () => import("../components/HealthcareDataQualityDashboard")
);
const HealthcareSourceReviewPanel = lazy(
  () => import("../components/HealthcareSourceReviewPanel")
);
const HealthcareStagingReviewPanel = lazy(
  () => import("../components/HealthcareStagingReviewPanel")
);

type InternalReviewView = "quality" | "source" | "staging";

const internalReviewViews: Array<{
  id: InternalReviewView;
  label: string;
}> = [
  { id: "quality", label: "Data quality" },
  { id: "source", label: "Source review" },
  { id: "staging", label: "Staging review" }
];

function InternalPanelLoadingState() {
  return (
    <p className="min-h-24 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-hb-muted">
      Loading review tools...
    </p>
  );
}

function InternalDataReviewPage() {
  const [activeView, setActiveView] = useState<InternalReviewView>("quality");
  const {
    facilities,
    isDemoMode,
    loadState
  } = useHealthcareFacilities(true);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-hb-text sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="rounded border border-slate-300 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-amber-800">
                Internal prototype · Not part of the public product
              </p>
              <h1 className="mt-2 text-2xl font-bold text-hb-deepNavy">
                Healthcare data review
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-hb-muted">
                Source review, staging, and pipeline-oriented quality tools live
                here so they do not compete with the public healthcare planning
                workflow. This route is not part of primary navigation.
              </p>
            </div>
            <NavLink
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-hb-navy transition hover:border-hb-teal/50 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hb-teal/30"
              to="/map"
            >
              Back to public map
            </NavLink>
          </div>
          <p className="mt-4 border-l-2 border-amber-600 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-slate-600">
            Local review artifacts may be unavailable in production builds because
            source imports, review files, and staging records are intentionally
            excluded from the public deployment bundle.
          </p>
        </header>

        <section className="mt-4 rounded border border-slate-300 bg-white p-4">
          <div
            aria-label="Internal healthcare data review tools"
            className="flex gap-4 overflow-x-auto border-b border-slate-200"
            role="tablist"
          >
            {internalReviewViews.map((view) => (
              <button
                aria-selected={activeView === view.id}
                className={`shrink-0 border-b-2 px-1 py-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-hb-teal/30 ${
                  activeView === view.id
                    ? "border-hb-teal text-hb-deepNavy"
                    : "border-transparent text-hb-muted hover:border-slate-300"
                }`}
                key={view.id}
                onClick={() => setActiveView(view.id)}
                role="tab"
                type="button"
              >
                {view.label}
              </button>
            ))}
          </div>

          <div className="mt-4" role="tabpanel">
            <Suspense fallback={<InternalPanelLoadingState />}>
              {activeView === "quality" && (
                <HealthcareDataQualityDashboard
                  facilities={facilities}
                  isDemoMode={isDemoMode}
                  loadState={loadState}
                />
              )}
              {activeView === "source" && <HealthcareSourceReviewPanel />}
              {activeView === "staging" && <HealthcareStagingReviewPanel />}
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}

export default InternalDataReviewPage;
