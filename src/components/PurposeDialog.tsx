import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { parseMapPermalink } from "./map/mapPermalink";
import { newarkExampleUrl } from "./map/mapExamples";

const welcomeSessionKey = "careatlas:welcome-seen";

export function PurposeDialog() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(() => {
    // A shared result or a story link should open directly at its destination.
    if (location.pathname !== "/" || parseMapPermalink(location.search)) return false;
    try { return sessionStorage.getItem(welcomeSessionKey) !== "1"; }
    catch { return true; }
  });
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  function dismiss() {
    try { sessionStorage.setItem(welcomeSessionKey, "1"); } catch { /* Storage is optional. */ }
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    continueButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
      if (event.key === "Tab") {
        const items = dialogRef.current?.querySelectorAll<HTMLElement>("a[href], button");
        const first = items?.[0];
        const last = items?.[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      aria-describedby="careatlas-purpose-description"
      aria-labelledby="careatlas-purpose-title"
      aria-modal="true"
      className="fixed inset-0 z-[3000] flex items-end justify-center bg-hb-deepNavy/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-5"
      role="dialog"
      ref={dialogRef}
    >
      <section className="w-full max-w-xl overflow-hidden rounded-t-2xl border border-white/50 bg-white shadow-2xl sm:rounded-2xl">
        <div className="h-1.5 bg-hb-aqua" />
        <div className="px-5 pb-5 pt-6 sm:px-7 sm:pb-7 sm:pt-7">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-hb-teal">
            Welcome to CareAtlas NJ
          </p>
          <h1
            className="mt-2 text-2xl font-black tracking-[-0.035em] text-hb-deepNavy sm:text-3xl"
            id="careatlas-purpose-title"
          >
            What does the data say about care near you?
          </h1>
          <div
            className="mt-4 space-y-3 text-sm leading-6 text-slate-700 sm:text-base sm:leading-7"
            id="careatlas-purpose-description"
          >
            <p>
              CareAtlas NJ is an independent student-built public-health project.
              Search your town to explore local health needs, barriers to care
              and official primary-care shortage evidence in one place.
            </p>
            <p className="rounded-xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-sm leading-6 text-hb-deepNavy">
              Use the map to explore patterns and ask better questions—not to
              diagnose a community, rank facilities or prove that care is or is
              not available.
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-700">Start with your town, or explore Newark as a real example. A flag is a reason to look more closely, not proof that care is unavailable.</p>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            <a className="inline-flex items-center justify-center rounded-lg border border-hb-teal px-4 py-2.5 text-sm font-bold text-hb-navy focus:outline-none focus:ring-2 focus:ring-hb-aqua" href={newarkExampleUrl} onClick={dismiss}>
              Explore an example: Newark
            </a>
            <button className="rounded-lg bg-hb-deepNavy px-4 py-2.5 text-sm font-bold text-white hover:bg-hb-teal focus:outline-none focus:ring-2 focus:ring-hb-aqua focus:ring-offset-2" onClick={dismiss} ref={continueButtonRef} type="button">
              Explore my area
            </button>
          </div>
          <div className="mt-3 text-center">
            <Link
              className="inline-flex justify-center rounded-lg border border-hb-border px-4 py-2.5 text-sm font-bold text-hb-deepNavy transition hover:border-hb-teal hover:text-hb-teal focus:outline-none focus:ring-2 focus:ring-hb-aqua"
              onClick={dismiss}
              to="/story"
            >
              See project decisions
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
