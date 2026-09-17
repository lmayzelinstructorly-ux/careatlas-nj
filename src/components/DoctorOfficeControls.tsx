import type { DoctorOfficeLoadState } from "../hooks/useDoctorOffices";
import type {
  DoctorOfficeArtifact,
  DoctorOfficeSpecialtyId
} from "../types/doctorOffice";
import { getDoctorOfficeFreshness } from "../utils/doctorOfficeDiscovery";

type DoctorOfficeControlsProps = {
  data: DoctorOfficeArtifact | null;
  error: string;
  loadState: DoctorOfficeLoadState;
  matchingOfficeCount: number;
  onViewSearchResults: () => void;
  onSearchQueryChange: (query: string) => void;
  onSpecialtyChange: (specialtyId: DoctorOfficeSpecialtyId | null) => void;
  searchQuery: string;
  selectedSpecialtyId: DoctorOfficeSpecialtyId | null;
  panelOpen: boolean;
};

const specialtyResultLabels: Record<DoctorOfficeSpecialtyId, string> = {
  dermatology: "dermatology",
  oncology: "oncology",
  pediatrics: "pediatric"
};

export function DoctorOfficeControls({
  data,
  error,
  loadState,
  matchingOfficeCount,
  onViewSearchResults,
  onSearchQueryChange,
  onSpecialtyChange,
  searchQuery,
  selectedSpecialtyId,
  panelOpen
}: DoctorOfficeControlsProps) {
  const selectedSpecialty =
    data?.specialties.find(({ id }) => id === selectedSpecialtyId) ?? null;
  const cmsSource = data?.sources.find(({ datasetId }) => datasetId === "mj5m-pzi6");
  const candidateOfficeCount = data?.coverage.candidateOfficeCount;
  const unpublishedCandidateCount = candidateOfficeCount
    ? candidateOfficeCount - data.coverage.officeCount
    : 0;
  const freshness = data ? getDoctorOfficeFreshness(data) : null;
  const specialtyResultLabel = selectedSpecialtyId
    ? specialtyResultLabels[selectedSpecialtyId]
    : "";
  const matchingOfficeLabel = matchingOfficeCount === 1
    ? "office location"
    : "office locations";
  const publishedOfficeLabel = selectedSpecialty?.officeCount === 1
    ? "office location"
    : "office locations";

  return (
    <section
      aria-label="Doctor office specialty controls"
      className={`absolute bottom-14 left-3 z-[1000] max-h-[calc(100%-5rem)] w-[20rem] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-lg border border-slate-300 bg-white/95 p-3 shadow-[0_10px_24px_rgb(0_43_77_/_0.16)] backdrop-blur sm:bottom-4 sm:left-4 ${panelOpen ? "max-sm:hidden" : ""}`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-hb-teal">
        New Jersey pilot
      </p>
      <h2 className="mt-1 text-sm font-black text-hb-deepNavy">
        Find a doctor's office
      </h2>
      <p className="mt-1 text-[11px] leading-4 text-hb-muted">
        Choose a specialty, then search by ZIP, town, practice or doctor's
        name. Listings come from CMS and may be incomplete.
      </p>

      <label
        className="mt-3 block text-xs font-bold text-hb-deepNavy"
        htmlFor="doctor-office-specialty"
      >
        Medical specialty
      </label>
      <select
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-hb-deepNavy outline-none focus:border-hb-aqua focus:ring-2 focus:ring-cyan-100 disabled:cursor-wait disabled:bg-slate-100"
        disabled={loadState !== "ready"}
        id="doctor-office-specialty"
        onChange={(event) =>
          onSpecialtyChange(
            (event.target.value as DoctorOfficeSpecialtyId) || null
          )
        }
        value={selectedSpecialtyId ?? ""}
      >
        <option value="">
          {loadState === "loading" ? "Loading specialties..." : "Select a specialty"}
        </option>
        {data?.specialties.map((specialty) => (
          <option key={specialty.id} value={specialty.id}>
            {specialty.label}
          </option>
        ))}
      </select>

      {selectedSpecialtyId && (
        <>
          <label
            className="mt-3 block text-xs font-bold text-hb-deepNavy"
            htmlFor="doctor-office-search"
          >
            Search by ZIP, town or name
          </label>
          <div className="relative mt-1.5">
            <input
              aria-describedby="doctor-office-search-help doctor-office-search-status"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-16 text-sm font-semibold text-hb-deepNavy outline-none placeholder:font-normal placeholder:text-slate-500 focus:border-hb-aqua focus:ring-2 focus:ring-cyan-100"
              id="doctor-office-search"
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Practice, city, ZIP, or provider"
              type="search"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                aria-label="Clear doctor-office search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[10px] font-bold text-hb-teal hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-hb-aqua"
                onClick={() => onSearchQueryChange("")}
                type="button"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px] leading-4 text-hb-muted" id="doctor-office-search-help">
            Try 08820, Edison, a practice or a doctor's name.
          </p>
        </>
      )}

      {loadState === "error" && (
        <p className="mt-2 text-[11px] font-semibold leading-4 text-rose-800" role="alert">
          Doctor-office data could not be loaded. {error}
        </p>
      )}

      {selectedSpecialty && (
        <div
          className="mt-3 rounded-md border border-hb-aqua/25 bg-hb-background px-2.5 py-2"
          id="doctor-office-search-status"
          role="status"
        >
          <p className="text-xs font-black text-hb-deepNavy">
            {selectedSpecialty.officeCount > 0
              ? searchQuery.trim()
                ? `${matchingOfficeCount.toLocaleString()} ${specialtyResultLabel} ${matchingOfficeLabel} found`
                : `${selectedSpecialty.officeCount.toLocaleString()} ${specialtyResultLabel} ${publishedOfficeLabel}`
              : `No validated ${selectedSpecialty.label.toLowerCase()} locations published yet`}
          </p>
          <p className="mt-1 text-[10px] leading-4 text-hb-muted">
            {selectedSpecialty.officeCount > 0
              ? searchQuery.trim()
                ? matchingOfficeCount > 0
                  ? "View all results below, or select a map number to see its group."
                  : "Try a different ZIP, town, practice or doctor's name."
                : "Map numbers show grouped locations. Select any number to see its list."
              : data?.coverage.explanation}
          </p>
          {searchQuery.trim() && matchingOfficeCount > 0 && (
            <button
              className="mt-2 rounded-md bg-hb-teal px-3 py-2 text-xs font-bold text-white hover:bg-hb-navy focus:outline-none focus:ring-2 focus:ring-hb-aqua"
              onClick={onViewSearchResults}
              type="button"
            >
              View {matchingOfficeCount.toLocaleString()} result{matchingOfficeCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}

      {freshness?.isStale && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-amber-900" role="status">
          This monthly pilot snapshot is older than its {freshness.staleAfterDays}-day
          review threshold. Treat locations as historical until the next source refresh.
        </p>
      )}

      <details className="mt-3 border-t border-slate-200 pt-2 text-[10px] leading-4 text-hb-muted">
        <summary className="cursor-pointer font-bold text-hb-deepNavy">
          Sources, freshness and limits
        </summary>
        <p className="mt-1.5">
          {cmsSource?.releaseDate
            ? `CMS Doctors and Clinicians release ${cmsSource.releaseDate}; source plan checked ${cmsSource.checkedDate}. `
            : "Source metadata is unavailable. "}
          Source dates describe snapshots, not real-time office status.
        </p>
        {freshness && (
          <p className="mt-1.5">
            CareAtlas reviews this monthly source by {freshness.nextReviewDate}
            {freshness.ageDays === null
              ? "."
              : `; this CMS release is ${freshness.ageDays.toLocaleString()} days old.`}
          </p>
        )}
        <p className="mt-1.5">
          Missing markers do not mean no clinician or office exists. Appointment
          availability, insurance, capacity and quality remain unknown.
        </p>
        {data && candidateOfficeCount !== undefined && candidateOfficeCount > 0 && (
          <p className="mt-1.5">
            This release maps {data.coverage.officeCount.toLocaleString()} of {candidateOfficeCount.toLocaleString()} eligible address groups.
            {unpublishedCandidateCount > 0
              ? ` ${unpublishedCandidateCount.toLocaleString()} groups without an accepted Census geocode are not shown.`
              : ""}
          </p>
        )}
        <p className="mt-1.5">
          NPPES screening excludes NPIs listed as deactivated in the pinned
          report; absence from that report does not prove current practice.
        </p>
        <p className="mt-1.5 font-semibold text-hb-navy">
          Doctor offices never affect potential-gap classifications.
        </p>
        {cmsSource && data && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {data.sources.map((source) => (
              <a
                className="font-bold text-hb-teal underline decoration-hb-aqua/60 underline-offset-2 hover:text-hb-navy"
                href={source.url}
                key={source.name}
                rel="noreferrer"
                target="_blank"
              >
                {source.datasetId
                  ? "CMS dataset"
                  : source.name.includes("NPPES")
                    ? "NPPES source"
                    : "Census geocoder"}
              </a>
            ))}
          </div>
        )}
      </details>
    </section>
  );
}
