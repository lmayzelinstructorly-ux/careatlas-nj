import type { HealthcareFacilityType } from "../types/healthcare";

type HealthcareFacilityPresentation = {
  label: string;
  markerClassName: string;
  symbolMarkup: string;
};

const buildingSymbol = `
  <path class="hb-healthcare-marker-symbol" d="M10.5 22V12.5h11V22M8.5 22h15M14 15.5h1.5M18 15.5h1.5M14 18.5h1.5M18 18.5h1.5M15.2 22v-2.3h1.6V22" />
`;

const facilityTypePresentations: Record<
  HealthcareFacilityType,
  HealthcareFacilityPresentation
> = {
  hospital: {
    label: "Hospital",
    markerClassName: "hb-healthcare-marker-icon--hospital",
    symbolMarkup: '<text class="hb-healthcare-marker-letter" x="16" y="20.5">H</text>'
  },
  clinic: {
    label: "Clinic",
    markerClassName: "hb-healthcare-marker-icon--clinic",
    symbolMarkup: buildingSymbol
  },
  urgent_care: {
    label: "Urgent care",
    markerClassName: "hb-healthcare-marker-icon--urgent-care",
    symbolMarkup: '<path class="hb-healthcare-marker-symbol" d="m18.5 9.5-6 7h4l-2 7 6-8h-4l2-6Z" />'
  },
  community_health_center: {
    label: "Community health center",
    markerClassName: "hb-healthcare-marker-icon--community-health-center",
    symbolMarkup: buildingSymbol
  },
  pharmacy: {
    label: "Pharmacy",
    markerClassName: "hb-healthcare-marker-icon--pharmacy",
    symbolMarkup: '<text class="hb-healthcare-marker-letter hb-healthcare-marker-letter--rx" x="16" y="19.7">Rx</text>'
  },
  mental_health: {
    label: "Mental health center",
    markerClassName: "hb-healthcare-marker-icon--mental-health",
    symbolMarkup: '<path class="hb-healthcare-marker-symbol" d="M16 21s-6-3.6-6-7.3c0-3 3.8-4.2 6-1.5 2.2-2.7 6-1.5 6 1.5 0 3.7-6 7.3-6 7.3Z" />'
  },
  dental: {
    label: "Dental care",
    markerClassName: "hb-healthcare-marker-icon--dental",
    symbolMarkup: '<text class="hb-healthcare-marker-letter" x="16" y="20.5">D</text>'
  },
  other: {
    label: "Other healthcare facility",
    markerClassName: "hb-healthcare-marker-icon--other",
    symbolMarkup: '<circle class="hb-healthcare-marker-symbol hb-healthcare-marker-symbol--filled" cx="16" cy="15.5" r="4" />'
  }
};

export function getHealthcareFacilityPresentation(
  facilityType: HealthcareFacilityType
) {
  return facilityTypePresentations[facilityType];
}
