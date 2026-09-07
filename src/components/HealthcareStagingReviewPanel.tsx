import { useEffect, useMemo, useState } from "react";
import type {
  HealthcareStagingStatus,
  StagedHealthcareFacility
} from "../types/healthcare";

type StagingLoadState = "loading" | "ready" | "error";

const statusLabels: Record<HealthcareStagingStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  needs_more_source_info: "Needs source info"
};

function hasIssue(record: StagedHealthcareFacility, code: string) {
  return record.stagingIssues.some((issue) => issue.code === code);
}

function hasBlockerIssue(record: StagedHealthcareFacility) {
  return record.stagingIssues.some((issue) => issue.severity === "blocker");
}

function hasValidCoordinates(record: StagedHealthcareFacility) {
  const { latitude, longitude } = record.facility;

  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function countRecords(
  records: StagedHealthcareFacility[],
  predicate: (record: StagedHealthcareFacility) => boolean
) {
  return records.filter(predicate).length;
}

function HealthcareStagingReviewPanel() {
  const [records, setRecords] = useState<StagedHealthcareFacility[]>([]);
  const [loadState, setLoadState] = useState<StagingLoadState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadStagingRecords() {
      try {
        const response = await fetch(
          "/data/healthcare/staging/facilities.staged.json"
        );

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Healthcare staging data must be an array.");
        }

        if (isMounted) {
          setRecords(data as StagedHealthcareFacility[]);
          setLoadState("ready");
          setError("");
        }
      } catch (loadError) {
        if (isMounted) {
          setRecords([]);
          setLoadState("error");
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Healthcare staging data could not be loaded."
          );
        }
      }
    }

    loadStagingRecords();

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(
    () => ({
      total: records.length,
      pending: countRecords(
        records,
        (record) => record.stagingStatus === "pending_review"
      ),
      approved: countRecords(
        records,
        (record) => record.stagingStatus === "approved"
      ),
      rejected: countRecords(
        records,
        (record) => record.stagingStatus === "rejected"
      ),
      needsMoreSourceInfo: countRecords(
        records,
        (record) => record.stagingStatus === "needs_more_source_info"
      ),
      missingCoordinates: countRecords(records, (record) =>
        hasIssue(record, "missing_coordinates")
      ),
      unknownPrice: countRecords(records, (record) =>
        hasIssue(record, "unknown_price_info")
      ),
      unknownInsurance: countRecords(records, (record) =>
        hasIssue(record, "unknown_insurance_info")
      ),
      unknownHours: countRecords(records, (record) =>
        hasIssue(record, "unknown_hours")
      ),
      enrichmentProvenance: countRecords(
        records,
        (record) =>
          hasIssue(record, "invalid_field_sources") ||
          hasIssue(record, "enrichment_needs_review")
      ),
      possibleDuplicates: countRecords(records, (record) =>
        hasIssue(record, "possible_duplicate")
      ),
      blockerIssues: countRecords(records, hasBlockerIssue),
      promotionReady: countRecords(
        records,
        (record) =>
          record.stagingStatus === "approved" &&
          !hasBlockerIssue(record) &&
          !hasIssue(record, "demo_looking_record") &&
          !hasIssue(record, "possible_duplicate") &&
          hasValidCoordinates(record)
      )
    }),
    [records]
  );
  const statusCounts: Array<{ label: string; value: number }> = [
    { label: statusLabels.pending_review, value: summary.pending },
    { label: statusLabels.approved, value: summary.approved },
    { label: statusLabels.rejected, value: summary.rejected },
    {
      label: statusLabels.needs_more_source_info,
      value: summary.needsMoreSourceInfo
    }
  ];
  const issueCounts = [
    { label: "Blocker issues", value: summary.blockerIssues },
    { label: "Missing coordinates", value: summary.missingCoordinates },
    { label: "Unknown price", value: summary.unknownPrice },
    { label: "Unknown insurance", value: summary.unknownInsurance },
    { label: "Unknown hours", value: summary.unknownHours },
    { label: "Enrichment provenance", value: summary.enrichmentProvenance },
    { label: "Possible duplicates", value: summary.possibleDuplicates }
  ];

  return (
    <section
      aria-labelledby="healthcare-staging-review-heading"
      className="rounded-lg border border-hb-aqua/25 bg-gradient-to-br from-white via-hb-background to-hb-aqua/10 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-hb-teal">
            Import staging
          </p>
          <h2
            className="mt-2 text-base font-black leading-tight text-hb-deepNavy"
            id="healthcare-staging-review-heading"
          >
            Staging review
          </h2>
        </div>
        <span className="rounded-md border border-hb-aqua/25 bg-white/86 px-2 py-1 text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-navy">
          Read only
        </span>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-hb-muted">
        Staging lets records be reviewed before they are promoted into
        production healthcare data.
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-hb-muted">
        Review statuses are updated through terminal commands so the static app
        stays read-only.
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-hb-muted">
        Enriched services, daily hours, insurance, cost or accessibility fields
        need field-level source URL and checked-date provenance before approval.
      </p>

      {loadState === "loading" && (
        <p className="mt-3 rounded-lg border border-hb-aqua/20 bg-white/80 px-3 py-2 text-sm font-semibold text-hb-muted">
          Loading staged healthcare records.
        </p>
      )}

      {loadState === "error" && (
        <p className="mt-3 rounded-lg border border-hb-aqua/25 bg-hb-background px-3 py-2 text-sm font-semibold leading-5 text-hb-navy">
          Staging data could not be loaded. {error}
        </p>
      )}

      {loadState === "ready" && records.length === 0 && (
        <p className="mt-3 rounded-lg border border-hb-border bg-white/84 px-3 py-3 text-sm font-semibold leading-6 text-hb-muted">
          No staged healthcare records yet.
        </p>
      )}

      {loadState === "ready" && (
        <>
          <div className="mt-3 rounded-lg border border-hb-border bg-white/86 px-3 py-2">
            <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
              Total staged
            </p>
            <p className="mt-1 text-xl font-black leading-none text-hb-deepNavy">
              {summary.total}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {statusCounts.map((item) => (
              <div
                className="rounded-lg border border-hb-border bg-white/86 px-3 py-2"
                key={item.label}
              >
                <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                  {item.label}
                </p>
                <p className="mt-1 text-lg font-black leading-none text-hb-deepNavy">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-hb-border bg-white/86 px-3 py-2">
              <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                Promotion-ready
              </p>
              <p className="mt-1 text-lg font-black leading-none text-hb-deepNavy">
                {summary.promotionReady}
              </p>
            </div>
            <div className="rounded-lg border border-hb-border bg-white/86 px-3 py-2">
              <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
                Blockers
              </p>
              <p className="mt-1 text-lg font-black leading-none text-hb-deepNavy">
                {summary.blockerIssues}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-hb-aqua/20 bg-white/82 px-3 py-3">
            <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
              Review warnings
            </p>
            <div className="mt-2 grid gap-2">
              {issueCounts.map((item) => (
                <div
                  className="flex items-center justify-between gap-2 text-xs font-bold"
                  key={item.label}
                >
                  <span className="text-hb-muted">{item.label}</span>
                  <span className="text-hb-deepNavy">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-hb-aqua/20 bg-white/82 px-3 py-3">
            <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
              Review workflow
            </p>
            <div className="mt-2 space-y-2 text-xs font-semibold leading-5 text-hb-muted">
              <p>
                Use{" "}
                <code className="font-black text-hb-deepNavy">
                  npm run list:healthcare:staging
                </code>{" "}
                to view records.
              </p>
              <p>
                Use{" "}
                <code className="font-black text-hb-deepNavy">
                  npm run review:healthcare:staged -- --id=... --status=approved --write
                </code>{" "}
                to approve a record.
              </p>
              <p>
                Use{" "}
                <code className="font-black text-hb-deepNavy">
                  npm run promote:healthcare:staging -- --write
                </code>{" "}
                to promote approved records.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default HealthcareStagingReviewPanel;
