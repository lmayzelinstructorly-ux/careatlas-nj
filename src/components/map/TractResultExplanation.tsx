import { useEffect, useRef, useState } from "react";
import type { TractPublicRecord } from "../../types/tractPublicRecord";

type GeminiExplanation = {
  model: string;
  reasons: string[];
  summary: string;
};

let geminiStatusRequest: Promise<boolean> | null = null;

function loadGeminiStatus() {
  geminiStatusRequest ??= fetch("/api/ai/status", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return false;
      const payload = (await response.json()) as {
        geminiExplanation?: boolean;
      };
      return payload.geminiExplanation === true;
    })
    .catch(() => false);
  return geminiStatusRequest;
}

function getNeedText(record: TractPublicRecord) {
  const findings = record.screening.findings;
  if (
    findings.elevatedCommunityHealthNeed &&
    findings.elevatedSocialBarriers
  ) {
    return "The reviewed public data crossed thresholds for both community health need and social barriers.";
  }
  if (findings.elevatedCommunityHealthNeed) {
    return "The reviewed public data crossed a threshold for community health need.";
  }
  if (findings.elevatedSocialBarriers) {
    return "The reviewed public data crossed a threshold for social barriers.";
  }
  return "The published rule did not find an elevated need or barrier threshold.";
}

function RuleResultExplanation({ record }: { record: TractPublicRecord }) {
  const state = record.screening.state;

  if (state === "potential_access_gap") {
    return (
      <section className="mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-hb-muted">
          Why this was flagged
        </h3>
        <p className="mt-1 text-sm leading-5 text-slate-700">
          CareAtlas calls this a potential gap because both parts of its
          published screening rule are present:
        </p>
        <ol className="mt-2 space-y-2">
          <li className="rounded-md border border-fuchsia-200 bg-fuchsia-50 p-3 text-sm leading-5 text-slate-700">
            <span className="font-bold text-hb-deepNavy">1. Need or barriers:</span>{" "}
            {getNeedText(record)}
          </li>
          <li className="rounded-md border border-fuchsia-200 bg-fuchsia-50 p-3 text-sm leading-5 text-slate-700">
            <span className="font-bold text-hb-deepNavy">2. Shortage evidence:</span>{" "}
            Official HRSA data show an active primary-care shortage or
            underserved-area designation overlapping this tract.
          </li>
        </ol>
        <p className="mt-2 text-xs leading-5 text-hb-muted">
          This is a planning signal—not proof that healthcare is absent, a
          diagnosis, or medical advice.
        </p>
      </section>
    );
  }

  const explanation =
    state === "elevated_need_without_documented_shortage"
      ? `${getNeedText(record)} CareAtlas did not find the matching official primary-care shortage evidence required to call it a potential gap.`
      : state === "no_current_gap_flag"
        ? "The published rule did not find elevated need or barriers. That does not prove healthcare access is adequate."
        : "One or more values required by the published rule are missing, so CareAtlas left the result unknown instead of guessing.";

  return (
    <section className="mt-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-hb-muted">
        Why this result
      </h3>
      <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-5 text-slate-700">
        {explanation}
      </p>
    </section>
  );
}

function GeminiExplanationPanel({ record }: { record: TractPublicRecord }) {
  const requestRef = useRef<AbortController | null>(null);
  const [configured, setConfigured] = useState(false);
  const [explanation, setExplanation] =
    useState<GeminiExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void loadGeminiStatus().then((available) => {
      if (active) setConfigured(available);
    });
    return () => {
      active = false;
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    requestRef.current?.abort();
    setExplanation(null);
    setError(null);
    setLoading(false);
  }, [record.geography.geoid]);

  async function requestExplanation() {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/explain", {
        body: JSON.stringify({ geoid: record.geography.geoid }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal
      });
      const payload = (await response.json()) as {
        error?: string;
        explanation?: GeminiExplanation;
      };
      if (!response.ok || !payload.explanation) {
        throw new Error(
          payload.error ?? "The AI explanation could not be loaded."
        );
      }
      setExplanation(payload.explanation);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "The AI explanation could not be loaded."
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  if (!configured) return null;

  return (
    <section className="mt-4 rounded-md border border-violet-200 bg-violet-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-hb-deepNavy">
          Gemini plain-language view
        </h3>
        <span className="rounded-full border border-violet-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">
          AI-assisted
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-700">
        Gemini can rephrase this same published result. It cannot change the
        status, and CareAtlas sends no searched address or free-form prompt.
      </p>

      {!explanation && (
        <button
          className="mt-3 rounded-md bg-violet-800 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-900 disabled:cursor-wait disabled:opacity-65"
          disabled={loading}
          onClick={() => void requestExplanation()}
          type="button"
        >
          {loading ? "Explaining..." : "Explain this result with Gemini"}
        </button>
      )}

      {explanation && (
        <div className="mt-3 rounded-md border border-violet-100 bg-white p-3">
          <p className="text-sm leading-5 text-slate-700">
            {explanation.summary}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
            {explanation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] leading-4 text-hb-muted">
            AI-generated wording · Verify it against the rule data and sources
            below.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs font-semibold leading-5 text-rose-700" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function TractResultExplanation({
  record
}: {
  record: TractPublicRecord;
}) {
  return (
    <>
      <RuleResultExplanation record={record} />
      <GeminiExplanationPanel record={record} />
    </>
  );
}
