import type {
  DoctorOfficeArtifact,
  DoctorOfficeLocation,
  DoctorOfficeSpecialtyId
} from "../types/doctorOffice";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function getOfficeSearchText(
  office: DoctorOfficeLocation,
  specialtyId: DoctorOfficeSpecialtyId
) {
  return normalizeSearchText([
    office.displayName,
    office.city,
    office.postalCode,
    ...office.practiceNames,
    ...office.providers
      .filter((provider) =>
        provider.normalizedSpecialtyIds.includes(specialtyId)
      )
      .flatMap((provider) => [
        provider.displayName,
        ...provider.groupNames
      ])
  ].filter(Boolean).join(" "));
}

export function filterDoctorOffices(
  offices: DoctorOfficeLocation[],
  specialtyId: DoctorOfficeSpecialtyId | null,
  searchQuery: string
) {
  if (!specialtyId) return [];

  const searchTerms = normalizeSearchText(searchQuery).split(" ").filter(Boolean);

  return offices.filter((office) => {
    if (!office.specialtyIds.includes(specialtyId)) return false;
    if (searchTerms.length === 0) return true;

    const officeSearchText = getOfficeSearchText(office, specialtyId);
    return searchTerms.every((term) => officeSearchText.includes(term));
  });
}

export type DoctorOfficeFreshness = {
  ageDays: number | null;
  isStale: boolean;
  nextReviewDate: string;
  staleAfterDays: number;
};

export function getDoctorOfficeFreshness(
  artifact: DoctorOfficeArtifact,
  now = new Date()
): DoctorOfficeFreshness {
  const cmsSource = artifact.sources.find(
    ({ datasetId }) => datasetId === "mj5m-pzi6"
  );
  const releaseTimestamp = cmsSource?.releaseDate
    ? Date.parse(`${cmsSource.releaseDate}T00:00:00Z`)
    : Number.NaN;
  const ageDays = Number.isFinite(releaseTimestamp)
    ? Math.max(0, Math.floor((now.getTime() - releaseTimestamp) / millisecondsPerDay))
    : null;

  return {
    ageDays,
    isStale:
      ageDays === null || ageDays > artifact.refreshPolicy.staleAfterDays,
    nextReviewDate: artifact.refreshPolicy.nextReviewDate,
    staleAfterDays: artifact.refreshPolicy.staleAfterDays
  };
}
