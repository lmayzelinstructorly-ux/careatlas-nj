import { useEffect, useMemo, useState } from "react";
import type {
  HealthcareImportReadinessStatus,
  HealthcareSourceReview,
  HealthcareSourceType
} from "../types/healthcare";

type SourceReviewsLoadState = "loading" | "ready" | "error";

const readinessLabels: Record<HealthcareImportReadinessStatus, string> = {
  ready_to_import: "Ready to import",
  needs_review: "Needs review",
  not_ready: "Not ready"
};

const sourceTypeLabels: Record<HealthcareSourceType, string> = {
  federal_open_data: "Federal open data",
  hospital_system: "Hospital system",
  manually_collected: "Manually collected",
  official: "Official",
  state_open_data: "State open data",
  unknown: "Unknown"
};

function getReadinessBadgeClass(status: HealthcareImportReadinessStatus) {
  if (status === "ready_to_import") {
    return "border-hb-green/35 bg-hb-green/12 text-[#2d7d25]";
  }

  if (status === "needs_review") {
    return "border-hb-aqua/35 bg-hb-aqua/12 text-hb-teal";
  }

  return "border-hb-navy/20 bg-hb-background text-hb-navy";
}

function formatLocation(review: HealthcareSourceReview) {
  return [review.state, review.county].filter(Boolean).join(" / ");
}

function getCount(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function HealthcareSourceReviewPanel() {
  const [loadState, setLoadState] = useState<SourceReviewsLoadState>("loading");
  const [reviews, setReviews] = useState<HealthcareSourceReview[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadReviews() {
      try {
        const response = await fetch("/data/healthcare/imports/source-reviews.json", {
          cache: "no-cache"
        });

        if (!response.ok) {
          throw new Error("Source reviews could not be loaded.");
        }

        const parsed = await response.json();

        if (!Array.isArray(parsed)) {
          throw new Error("Source reviews must be a JSON array.");
        }

        if (isMounted) {
          setReviews(parsed as HealthcareSourceReview[]);
          setLoadState("ready");
        }
      } catch {
        if (isMounted) {
          setReviews([]);
          setLoadState("error");
        }
      }
    }

    loadReviews();

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const sortedReviews = [...reviews].sort((firstReview, secondReview) =>
      (secondReview.dateChecked ?? "").localeCompare(firstReview.dateChecked ?? "")
    );
    const totalMissingCoordinates = reviews.reduce(
      (sum, review) => sum + getCount(review.missingCoordinates),
      0
    );
    const totalMissingPriceInfo = reviews.reduce(
      (sum, review) => sum + getCount(review.missingPriceInfo),
      0
    );
    const totalMissingInsuranceInfo = reviews.reduce(
      (sum, review) => sum + getCount(review.missingInsuranceInfo),
      0
    );
    const totalMissingHours = reviews.reduce(
      (sum, review) => sum + getCount(review.missingHours),
      0
    );

    return {
      notReadyCount: reviews.filter((review) => review.readinessStatus === "not_ready").length,
      readyCount: reviews.filter((review) => review.readinessStatus === "ready_to_import").length,
      recentReviews: sortedReviews.slice(0, 3),
      reviewCount: reviews.length,
      totalMissingCoordinates,
      totalMissingHours,
      totalMissingInsuranceInfo,
      totalMissingPriceInfo,
      needsReviewCount: reviews.filter((review) => review.readinessStatus === "needs_review").length
    };
  }, [reviews]);

  return (
    <section className="rounded-lg border border-hb-aqua/25 bg-white/88 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-hb-teal">
            Source review
          </p>
          <h2 className="mt-2 text-base font-black leading-tight text-hb-deepNavy">
            Import readiness
          </h2>
        </div>
        <span className="rounded-md border border-hb-border bg-hb-background px-2 py-1 text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-navy">
          Pre-import
        </span>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-hb-muted">
        Review source CSVs before moving real facility records into production.
      </p>
      <p className="mt-2 text-xs font-bold leading-5 text-hb-muted">
        Missing fields reduce score confidence but do not mean a facility is bad.
      </p>

      {loadState === "loading" && (
        <p className="mt-3 rounded-lg border border-hb-aqua/20 bg-hb-background px-3 py-2 text-sm font-semibold text-hb-muted">
          Loading source reviews.
        </p>
      )}

      {loadState === "error" && (
        <p className="mt-3 rounded-lg border border-hb-aqua/25 bg-hb-background px-3 py-2 text-sm font-semibold leading-5 text-hb-navy">
          Healthcare source reviews could not be loaded.
        </p>
      )}

      {loadState === "ready" && reviews.length === 0 && (
        <div className="mt-3 rounded-lg border border-hb-border bg-hb-background/80 px-3 py-4">
          <p className="text-sm font-black text-hb-deepNavy">
            No healthcare source reviews have been added yet.
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-hb-muted">
            Review a source CSV before importing it into production healthcare data.
          </p>
          <p className="mt-3 text-[11px] font-bold leading-5 text-hb-muted">
            Start with the review script, then run a dry-run import only after
            source gaps are understood.
          </p>
        </div>
      )}

      {loadState === "ready" && reviews.length > 0 && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-hb-border bg-hb-background/80 px-3 py-2">
              <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                Reviews
              </p>
              <p className="mt-1 text-xl font-black leading-none text-hb-deepNavy">
                {summary.reviewCount}
              </p>
            </div>
            <div className="rounded-lg border border-hb-border bg-hb-background/80 px-3 py-2">
              <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                Ready
              </p>
              <p className="mt-1 text-xl font-black leading-none text-hb-deepNavy">
                {summary.readyCount}
              </p>
            </div>
            <div className="rounded-lg border border-hb-border bg-hb-background/80 px-3 py-2">
              <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                Review
              </p>
              <p className="mt-1 text-xl font-black leading-none text-hb-deepNavy">
                {summary.needsReviewCount}
              </p>
            </div>
            <div className="rounded-lg border border-hb-border bg-hb-background/80 px-3 py-2">
              <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                Not ready
              </p>
              <p className="mt-1 text-xl font-black leading-none text-hb-deepNavy">
                {summary.notReadyCount}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-hb-aqua/20 bg-hb-background/80 px-3 py-3">
            <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
              Key data gaps
            </p>
            <div className="mt-2 grid gap-1 text-xs font-semibold leading-5 text-hb-muted">
              <p>Coordinates missing: {summary.totalMissingCoordinates}</p>
              <p>Price info missing: {summary.totalMissingPriceInfo}</p>
              <p>Insurance info missing: {summary.totalMissingInsuranceInfo}</p>
              <p>Hours missing: {summary.totalMissingHours}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {summary.recentReviews.map((review) => (
              <article
                className="rounded-lg border border-hb-border bg-white/90 px-3 py-3"
                key={review.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black leading-tight text-hb-deepNavy">
                      {review.sourceName}
                    </h3>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-hb-teal">
                      {sourceTypeLabels[review.sourceType] ?? review.sourceType}
                    </p>
                  </div>
                  <span
                    className={[
                      "rounded-md border px-2 py-1 text-[10px] font-black uppercase leading-none tracking-[0.08em]",
                      getReadinessBadgeClass(review.readinessStatus)
                    ].join(" ")}
                  >
                    {readinessLabels[review.readinessStatus]}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-hb-muted">
                  {formatLocation(review) || "Location not specified"} -{" "}
                  {getCount(review.recordsReviewed)} reviewed -{" "}
                  {getCount(review.recordsImportReady)} import-ready
                </p>
                <p className="mt-2 text-xs font-semibold leading-5 text-hb-muted">
                  Missing coordinates: {getCount(review.missingCoordinates)} -
                  price: {getCount(review.missingPriceInfo)} - insurance:{" "}
                  {getCount(review.missingInsuranceInfo)} - hours:{" "}
                  {getCount(review.missingHours)}
                </p>
                {review.notes && (
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-hb-muted">
                    {review.notes}
                  </p>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default HealthcareSourceReviewPanel;
