import type { HealthcareFacility } from "../types/healthcare";

export type WeeklyOperatingHoursEvidence = {
  displayOnly: true;
  evidenceLocation: "hours.notes" | "sourceInfo.notes";
  label: "weekly operating hours metadata";
  note: string;
  operatingHoursPerWeek: number;
  sourceName: string;
  sourceUrl: string;
  lastChecked: string;
};

export type LimitedServiceSignalEvidence = {
  displayOnly: true;
  label: "facility type/site type signal";
  note: string;
  signal: string;
  sourceName: string;
  sourceUrl: string;
  lastChecked: string;
};

export type LimitedRowLevelEvidenceSummary = {
  displayOnly: true;
  hasAnyLimitedEvidence: boolean;
  hasOfficialRowLevelProvenance: boolean;
  limitedEvidenceNotes: string[];
  limitedServiceSignal: LimitedServiceSignalEvidence | null;
  weeklyOperatingHoursEvidence: WeeklyOperatingHoursEvidence | null;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sourceNoteEntries(facility: HealthcareFacility) {
  return [
    ["hours.notes", facility.hours?.notes],
    ["sourceInfo.notes", facility.sourceInfo?.notes]
  ] as const;
}

function combinedOfficialNotes(facility: HealthcareFacility) {
  return sourceNoteEntries(facility)
    .map(([, value]) => value)
    .filter(hasText)
    .join(" ");
}

function sourceInfo(facility: HealthcareFacility) {
  const sourceName = facility.sourceInfo?.sourceName;
  const sourceUrl = facility.sourceInfo?.sourceUrl;
  const lastChecked = facility.sourceInfo?.lastChecked;

  if (!hasText(sourceName) || !hasText(sourceUrl) || !hasText(lastChecked)) {
    return null;
  }

  return {
    lastChecked,
    sourceName,
    sourceUrl
  };
}

export function hasOfficialRowLevelProvenance(facility: HealthcareFacility) {
  return Boolean(
    hasText(facility.sourceId) &&
      hasText(facility.sourceDataset) &&
      sourceInfo(facility)
  );
}

export function getWeeklyOperatingHoursEvidence(
  facility: HealthcareFacility
): WeeklyOperatingHoursEvidence | null {
  if (!hasOfficialRowLevelProvenance(facility)) {
    return null;
  }

  const source = sourceInfo(facility);

  if (!source) {
    return null;
  }

  for (const [evidenceLocation, note] of sourceNoteEntries(facility)) {
    const match = note?.match(
      /\bHRSA operating hours per week\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i
    );

    if (!match) {
      continue;
    }

    const operatingHoursPerWeek = Number.parseFloat(match[1]);

    if (!Number.isFinite(operatingHoursPerWeek)) {
      return null;
    }

    return {
      ...source,
      displayOnly: true,
      evidenceLocation,
      label: "weekly operating hours metadata",
      note:
        "Limited weekly hours metadata available, but daily hours are not listed.",
      operatingHoursPerWeek
    };
  }

  return null;
}

function getServiceSignalText(facility: HealthcareFacility) {
  const notes = combinedOfficialNotes(facility);

  if (facility.facilityType === "community_health_center") {
    return "community health center facility type";
  }

  const noteMatch = notes.match(
    /\b(?:site setting|location setting|hospital type|CMS site type|HRSA site type|site type|operational status|emergency services listed by CMS)\s*:?\s*([^.;]+)/i
  );

  if (noteMatch?.[1]) {
    return noteMatch[0].trim();
  }

  return "";
}

export function hasLimitedServiceSignal(facility: HealthcareFacility) {
  return Boolean(
    hasOfficialRowLevelProvenance(facility) && hasText(getServiceSignalText(facility))
  );
}

export function getLimitedRowLevelEvidenceSummary(
  facility: HealthcareFacility
): LimitedRowLevelEvidenceSummary {
  const weeklyOperatingHoursEvidence = getWeeklyOperatingHoursEvidence(facility);
  const source = sourceInfo(facility);
  const serviceSignalText = getServiceSignalText(facility);
  const limitedServiceSignal =
    hasOfficialRowLevelProvenance(facility) && source && hasText(serviceSignalText)
      ? {
          ...source,
          displayOnly: true as const,
          label: "facility type/site type signal" as const,
          note:
            "Facility type/site type signal available, but specific services are not listed.",
          signal: serviceSignalText
        }
      : null;
  const limitedEvidenceNotes = [
    weeklyOperatingHoursEvidence?.note,
    limitedServiceSignal?.note,
    weeklyOperatingHoursEvidence || limitedServiceSignal
      ? "This supports display-only planning context and is not used for ranking or comparison."
      : ""
  ].filter(hasText);

  return {
    displayOnly: true,
    hasAnyLimitedEvidence: Boolean(
      weeklyOperatingHoursEvidence || limitedServiceSignal
    ),
    hasOfficialRowLevelProvenance: hasOfficialRowLevelProvenance(facility),
    limitedEvidenceNotes,
    limitedServiceSignal,
    weeklyOperatingHoursEvidence
  };
}
