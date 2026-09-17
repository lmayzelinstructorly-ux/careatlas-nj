import { useEffect } from "react";
import { Link } from "react-router-dom";
import { SiteBrand } from "../components/SiteBrand";

const metrics = [
  { label: "official Census tracts", value: "2,181" },
  { label: "towns and townships", value: "564" },
  { label: "source-backed facilities", value: "215" },
  { label: "doctor-office pilot specialties", value: "3" },
  { label: "clear screening results", value: "4" }
];

const plainLanguageTerms = [
  {
    title: "What is a Census tract?",
    text: "A tract is a small area the U.S. Census Bureau uses to publish local statistics. It is smaller than a county and usually smaller than a town, but its lines do not always match a neighborhood or municipal border."
  },
  {
    title: "What counts as a facility here?",
    text: "The current map includes source-backed hospitals and HRSA community health centers. A community health center here is a service site operated by an organization in the federal HRSA Health Center Program, including designated Look-Alikes. These community-based clinics serve everyone, even if they cannot pay, and adjust fees based on income and family size. The map does not claim to show every physician office, specialist, pharmacy or place where care may be available."
  },
  {
    title: "What is the doctor-office pilot?",
    text: "It is a separate discovery layer for CMS-listed New Jersey practice locations in pediatrics, dermatology and oncology. It is not a complete provider directory, does not show appointment or insurance availability and never changes a potential-gap result."
  },
  {
    title: "What is a potential access gap?",
    text: "It is a tract where higher community need or social barriers appear alongside official primary-care shortage evidence. It is a screening flag, not proof that healthcare is absent."
  }
];

const buildStages = [
  {
    number: "01",
    title: "Start with official boundaries",
    text: "I used Census boundaries for New Jersey counties, towns, townships and tracts. The map loads them in smaller pieces so it can stay useful without downloading the whole country."
  },
  {
    number: "02",
    title: "Bring the public evidence together",
    text: "The health, social-barrier and shortage data come from CDC, Census and HRSA sources. The separate doctor-office pilot uses CMS, NPPES and Census geocoding. I kept each source date, missing value and join field so a result can be checked later."
  },
  {
    number: "03",
    title: "Use one rule people can inspect",
    text: "A tract is flagged only when the data show higher need or barriers and documented primary-care shortage evidence. If a required value is missing, the result stays unknown."
  },
  {
    number: "04",
    title: "Make the result easy to explore",
    text: "The public map moves from counties and towns to tract-level detail. Address search, short explanations and links to the underlying sources help people understand how each result was reached."
  }
];

const decisions = [
  {
    title: "Pins provide context",
    text: "A pin shows a source-backed facility or CMS-listed practice-location record. Fewer pins do not prove that an area has less care, so neither facility nor doctor-office locations decide whether a tract is flagged."
  },
  {
    title: "Missing stays unknown",
    text: "The map does not turn a blank into zero or silently remove it. When the rule is missing a required input, CareAtlas says that the evidence is incomplete."
  },
  {
    title: "AI is optional",
    text: "Gemini can rewrite an already-completed tract result in simpler language. It cannot see a searched address, change the rule or add medical advice."
  }
];

const lessons = [
  {
    label: "Similar borders can still draw differently",
    text: "County, town and tract files are simplified separately. When their edges looked inconsistent, the right fix was a display layer, not changing an official boundary."
  },
  {
    label: "A search result needs one clear landing point",
    text: "Address lookup now waits for the matching tract before showing the result, so the map does not flash through several temporary cards on the way there."
  },
  {
    label: "Speed affects understanding",
    text: "The map caches labels, groups nearby locations and loads doctor-office, facility and tract data only when each mode needs them. A faster response makes the geographic levels easier to follow."
  }
];

function StoryHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <SiteBrand compact />
        <nav aria-label="Project navigation" className="flex items-center gap-2">
          <a className="hidden rounded-md px-3 py-2 text-sm font-bold text-hb-muted transition hover:bg-slate-100 hover:text-hb-deepNavy sm:inline-flex" href="#overview">
            Overview
          </a>
          <a className="hidden rounded-md px-3 py-2 text-sm font-bold text-hb-muted transition hover:bg-slate-100 hover:text-hb-deepNavy md:inline-flex" href="#process">
            How it works
          </a>
          <Link className="inline-flex rounded-md bg-hb-deepNavy px-3.5 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-hb-teal focus:outline-none focus:ring-2 focus:ring-hb-aqua" to="/">
            Explore the map
          </Link>
        </nav>
      </div>
    </header>
  );
}

function ProjectStoryPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    const previousDescription = description?.content;
    const previousCanonical = canonical?.href;
    document.title = "How I built CareAtlas NJ";
    if (description) {
      description.content =
        "How CareAtlas NJ turns official Census, CDC, ACS, HRSA, CMS and NPPES data into a transparent New Jersey healthcare access map and limited doctor-office discovery pilot.";
    }
    if (canonical) {
      canonical.href = new URL("/story", window.location.origin).href;
    }
    return () => {
      document.title = previousTitle;
      if (description && previousDescription) {
        description.content = previousDescription;
      }
      if (canonical && previousCanonical) canonical.href = previousCanonical;
    };
  }, []);

  useEffect(() => {
    const revealItems = Array.from(
      document.querySelectorAll<HTMLElement>("[data-story-reveal]")
    );
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.12 }
    );

    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f7f7] text-hb-text">
      <StoryHeader />
      <main>
        <section className="relative overflow-hidden bg-hb-deepNavy px-5 py-16 text-white sm:px-8 sm:py-24">
          <div aria-hidden="true" className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div aria-hidden="true" className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-hb-aqua/20 blur-3xl" />
          <div className="relative mx-auto max-w-6xl text-center">
            <div className="hb-story-reveal" data-story-reveal>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-hb-aqua">
                An independent student-built public-data project
              </p>
              <h1 className="mx-auto mt-5 max-w-5xl text-4xl font-black leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                Where might getting primary care be harder?
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">
                I built CareAtlas NJ to turn several public datasets into one map people can question, not just trust at a glance. It screens small areas for signs of higher need and documented primary-care shortage without pretending that a map can diagnose a community.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link className="rounded-md bg-hb-aqua px-5 py-3 text-sm font-black text-hb-deepNavy transition hover:-translate-y-0.5 hover:bg-white" to="/?mode=gaps">
                  Explore potential gaps
                </Link>
                <Link className="rounded-md border border-white/35 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15" to="/?mode=healthcare">
                  See healthcare facilities
                </Link>
                <Link className="rounded-md border border-white/35 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15" to="/?mode=doctor-offices">
                  Explore doctor-office pilot
                </Link>
              </div>
            </div>

            <aside className="hb-story-reveal mx-auto mt-12 max-w-5xl rounded-3xl border border-white/20 bg-white/10 p-6 text-left shadow-2xl backdrop-blur sm:p-9" data-story-reveal>
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-hb-aqua">Project at a glance</p>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  One New Jersey map built from public data, with every missing value and limitation kept visible.
                </p>
              </div>
              <dl className="hb-story-stagger mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {metrics.map((metric) => (
                  <div className="hb-story-reveal rounded-2xl border border-white/10 bg-hb-deepNavy/75 p-5 text-center transition hover:-translate-y-1 hover:border-hb-aqua/45" data-story-reveal key={metric.label}>
                    <dd className="text-3xl font-black tracking-tight text-white sm:text-4xl">{metric.value}</dd>
                    <dt className="mt-2 text-xs font-bold leading-5 text-slate-300">{metric.label}</dt>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-24" id="overview">
          <div className="hb-story-reveal mx-auto max-w-7xl" data-story-reveal>
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-hb-teal">Start here</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-hb-deepNavy sm:text-4xl">
                Four terms make the map easier to understand.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-700 sm:text-lg">
                CareAtlas uses a few public-data terms that are easy to misread. Here is what they mean in this project.
              </p>
            </div>
            <div className="hb-story-stagger mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {plainLanguageTerms.map((term, index) => (
                <article className="hb-story-reveal rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_28px_rgba(23,49,61,0.07)] transition hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(23,49,61,0.11)]" data-story-reveal key={term.title}>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-50 text-sm font-black text-hb-teal">{index + 1}</span>
                  <h3 className="mt-4 text-xl font-black text-hb-deepNavy">{term.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{term.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-5 py-16 sm:px-8 sm:py-24">
          <div className="hb-story-reveal mx-auto grid max-w-7xl gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-start" data-story-reveal>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-hb-teal">Why I built it</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-hb-deepNavy sm:text-4xl">
                A pin count cannot answer an access question.
              </h2>
            </div>
            <div className="space-y-5 text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">
              <p>
                The tempting version of this project was simple: count nearby facilities, color places with fewer pins and call them gaps. The problem is that a pin cannot tell us about capacity, appointment availability, cost, transportation or whether a dataset captured every provider.
              </p>
              <p>
                So I changed the question. Instead of asking where care is definitely missing, CareAtlas asks where public indicators suggest that access deserves a closer look. That narrower claim is more useful because the map can show exactly which evidence supports it and where the evidence runs out.
              </p>
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-24" id="process">
          <div className="mx-auto max-w-7xl">
            <div className="hb-story-reveal" data-story-reveal>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-hb-teal">How it works</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.035em] text-hb-deepNavy sm:text-4xl">
                The map is the last step, not the first.
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700 sm:text-lg">
                Each step narrows what the project can responsibly say. The result is a short, repeatable path from public records to a map flag.
              </p>
            </div>
            <div className="hb-story-stagger relative mt-10 grid gap-5 md:grid-cols-2">
              {buildStages.map((stage) => (
                <article className="hb-story-reveal group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-hb-aqua/45 hover:shadow-[0_14px_32px_rgba(23,49,61,0.09)]" data-story-reveal key={stage.number}>
                  <div className="flex items-center gap-3">
                    <p className="flex h-10 w-10 items-center justify-center rounded-full bg-hb-deepNavy text-sm font-black text-hb-aqua transition group-hover:bg-hb-teal group-hover:text-white">{stage.number}</p>
                    <div aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-hb-aqua/70 to-transparent" />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-hb-deepNavy">{stage.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{stage.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#e7efee] px-5 py-16 sm:px-8 sm:py-24" id="decisions">
          <div className="mx-auto max-w-7xl">
            <div className="hb-story-reveal grid gap-8 lg:grid-cols-[.65fr_1.35fr]" data-story-reveal>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-hb-teal">Important limits</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-hb-deepNavy sm:text-4xl">
                  The project is careful about what it does not claim.
                </h2>
              </div>
              <div className="hb-story-stagger grid gap-4 sm:grid-cols-3">
                {decisions.map((decision) => (
                  <article className="hb-story-reveal rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(23,49,61,0.06)] transition hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(23,49,61,0.1)]" data-story-reveal key={decision.title}>
                    <div aria-hidden="true" className="h-2 w-10 rounded-full bg-hb-aqua" />
                    <h3 className="mt-4 text-lg font-black text-hb-deepNavy">{decision.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{decision.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="hb-story-reveal" data-story-reveal>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-hb-teal">What changed during testing</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.035em] text-hb-deepNavy sm:text-4xl">
                The confusing parts pointed to better solutions.
              </h2>
            </div>
            <div className="hb-story-stagger mt-9 grid gap-5 lg:grid-cols-3">
              {lessons.map((lesson) => (
                <article className="hb-story-reveal border-l-4 border-hb-aqua bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(23,49,61,0.09)]" data-story-reveal key={lesson.label}>
                  <h3 className="text-lg font-black text-hb-deepNavy">{lesson.label}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{lesson.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-5 py-16 sm:px-8 sm:py-24">
          <div className="hb-story-reveal mx-auto grid max-w-7xl gap-8 rounded-3xl bg-hb-background p-7 shadow-[0_16px_44px_rgba(23,49,61,0.1)] sm:p-10 lg:grid-cols-[1.15fr_.85fr] lg:items-center" data-story-reveal>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-hb-teal">What comes next</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-hb-deepNavy sm:text-4xl">
                The next milestone is outside validation.
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">
                I am preparing short sessions with New Jersey residents to see whether they can find their town, understand a result and check its limits. A separate review with public-health professionals will examine the screening rule and its assumptions. These reviews have not yet been completed; working software alone does not establish real-world usefulness.
              </p>
            </div>
            <div className="rounded-2xl border border-hb-aqua/30 bg-white p-5">
              <p className="text-sm font-black text-hb-deepNavy">Current boundaries</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                <li>Independent project; not a government service.</li>
                <li>Public-health planning context only.</li>
                <li>No patient data, diagnoses or facility rankings.</li>
                <li>One New Jersey map; future expansion needs the same validation process.</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="bg-hb-deepNavy px-5 py-14 text-white sm:px-8">
          <div className="hb-story-reveal mx-auto flex max-w-7xl flex-col justify-between gap-7 sm:flex-row sm:items-center" data-story-reveal>
            <div>
              <p className="text-2xl font-black tracking-tight">Questions or feedback?</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Feedback on the map, its explanations and its limitations is welcome. Contact the CareAtlas project on GitHub at <span className="font-bold text-white">@methmoussa</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="inline-flex w-fit rounded-md border border-white/30 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10" href="https://github.com/methmoussa" rel="noreferrer" target="_blank">
                Contact the project
              </a>
              <Link className="inline-flex w-fit rounded-md bg-hb-aqua px-5 py-3 text-sm font-black text-hb-deepNavy transition hover:-translate-y-0.5 hover:bg-white" to="/">
                Explore CareAtlas NJ
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default ProjectStoryPage;
