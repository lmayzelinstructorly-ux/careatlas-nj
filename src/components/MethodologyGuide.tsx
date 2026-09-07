import { useEffect } from "react";

type MethodologyGuideProps = {
  isOpen: boolean;
  onClose: () => void;
};

const screeningStates = [
  {
    label: "Potential access gap",
    text: "Elevated community health need or social barriers appear with an active reviewed primary-care shortage designation."
  },
  {
    label: "Elevated need without documented shortage",
    text: "Elevated need or barriers appear, but the reviewed data do not show a matching active primary-care shortage designation."
  },
  {
    label: "No current gap flag",
    text: "The published elevated-need condition was not met. This does not prove that access is adequate."
  },
  {
    label: "Insufficient evidence",
    text: "At least one required value is missing, so CareAtlas does not guess or replace it with zero."
  }
];

export function MethodologyGuide({ isOpen, onClose }: MethodologyGuideProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      aria-labelledby="methodology-guide-title"
      aria-modal="true"
      className="fixed inset-0 z-[2200] flex items-end justify-center bg-hb-deepNavy/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <section className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-hb-teal">
              Published data and transparent rules
            </p>
            <h2
              className="text-xl font-black tracking-tight text-hb-deepNavy sm:text-2xl"
              id="methodology-guide-title"
            >
              How CareAtlas identifies potential access gaps
            </h2>
          </div>
          <button
            aria-label="Close methodology guide"
            className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-bold text-hb-deepNavy transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-hb-aqua"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-7">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
            <p className="text-lg font-black leading-7 text-hb-deepNavy">
              Facility pins alone never prove a healthcare access gap.
            </p>
            <p className="mt-2 text-sm leading-6 text-hb-muted">
              CareAtlas combines modeled community-health estimates, social-barrier
              evidence and active official shortage designations. Every result
              preserves its source, date, missingness and published rule version.
            </p>
          </section>

          <section>
            <h3 className="text-base font-black text-hb-deepNavy">
              The three-part evidence structure
            </h3>
            <ol className="mt-3 grid gap-3 sm:grid-cols-3">
              <li className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-hb-teal">1. Community health need</p>
                <p className="mt-2 text-sm leading-5 text-slate-700">At least two of four published CDC PLACES thresholds must trigger.</p>
              </li>
              <li className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-hb-teal">2. Social barriers</p>
                <p className="mt-2 text-sm leading-5 text-slate-700">The official overall SVI national percentile is checked against the published threshold.</p>
              </li>
              <li className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-hb-teal">3. Documented shortage</p>
                <p className="mt-2 text-sm leading-5 text-slate-700">Active reviewed HRSA primary-care HPSA and MUA/P designations stay separate and source-backed.</p>
              </li>
            </ol>
          </section>

          <section>
            <h3 className="text-base font-black text-hb-deepNavy">How to read the result</h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {screeningStates.map((state) => (
                <div className="rounded-xl border border-slate-200 bg-white p-4" key={state.label}>
                  <dt className="text-sm font-bold text-hb-deepNavy">{state.label}</dt>
                  <dd className="mt-1 text-xs leading-5 text-slate-700">{state.text}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <h3 className="text-base font-black text-hb-deepNavy">What stays contextual</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Transportation, insurance, poverty, disability, additional SVI
              themes, dental and mental-health shortages, and nearby facilities
              can help explain local conditions. They do not silently change the
              screening rule. Action paths link to official resources to
              investigate; they are not personalized recommendations or
              guaranteed solutions.
            </p>
          </section>

          <p className="text-xs leading-5 text-hb-muted">
            CareAtlas is a public-health screening tool. It does not provide
            medical advice, diagnose individuals, rank communities or rate the
            quality of healthcare facilities.
          </p>
        </div>
      </section>
    </div>
  );
}
