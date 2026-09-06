import { describe, expect, it } from "vitest";
import type {
  DoctorOfficeArtifact,
  DoctorOfficeLocation
} from "../types/doctorOffice";
import {
  filterDoctorOffices,
  getDoctorOfficeFreshness
} from "./doctorOfficeDiscovery";

const office: DoctorOfficeLocation = {
  addressLine1: "123 Example Street",
  addressLine2: "Suite 4",
  addressPrecision: "suite",
  city: "Newark",
  countyFips: "013",
  displayName: "Example Pediatric Group",
  id: "fixture-office",
  latitude: 40.73,
  longitude: -74.17,
  phone: null,
  postalCode: "07102",
  practiceNames: ["Example Pediatrics"],
  providers: [{
    credentials: ["MD"],
    displayName: "Jamie Rivera",
    enrollmentIds: ["fixture-enrollment"],
    groupNames: ["Example Medical Partners"],
    normalizedSpecialtyIds: ["pediatrics"],
    npi: "0000000000",
    nppesStatus: "not_deactivated_in_snapshot",
    primarySpecialties: ["PEDIATRIC MEDICINE"],
    secondarySpecialties: []
  }],
  provenance: {
    censusGeocoderBenchmark: "fixture",
    censusGeocoderCheckedDate: "2026-08-30",
    censusGeocoderMatchedAddress: "fixture",
    censusGeocoderMatchType: "Exact",
    cmsAddressId: "fixture-address",
    cmsDatasetId: "mj5m-pzi6",
    cmsReleaseDate: "2026-08-13",
    nppesCheckedDate: "2026-08-30",
    sourceRowIds: ["fixture-row"]
  },
  specialtyIds: ["pediatrics"],
  state: "NJ"
};

const artifact = {
  refreshPolicy: {
    cadence: "monthly",
    nextReviewDate: "2026-09-10",
    staleAfterDays: 45
  },
  sources: [{
    checkedDate: "2026-08-30",
    datasetId: "mj5m-pzi6",
    name: "CMS fixture",
    releaseDate: "2026-08-13",
    url: "https://example.test/cms"
  }]
} as DoctorOfficeArtifact;

describe("doctor-office discovery helpers", () => {
  it("matches practice, city, ZIP and provider terms within a specialty", () => {
    for (const query of [
      "Jamie Rivera",
      "Example Pediatrics",
      "Medical Partners",
      "Newark",
      "07102"
    ]) {
      expect(filterDoctorOffices([office], "pediatrics", query)).toEqual([office]);
    }
    expect(filterDoctorOffices([office], "pediatrics", "Example Street")).toEqual([]);
    expect(filterDoctorOffices([office], "dermatology", "Newark")).toEqual([]);
    expect(filterDoctorOffices([office], "pediatrics", "Newark oncology")).toEqual([]);

    const mixedOffice: DoctorOfficeLocation = {
      ...office,
      providers: [
        ...office.providers,
        {
          ...office.providers[0],
          displayName: "Casey Skin",
          normalizedSpecialtyIds: ["dermatology"],
          primarySpecialties: ["DERMATOLOGY"]
        }
      ],
      specialtyIds: ["pediatrics", "dermatology"]
    };
    expect(filterDoctorOffices([mixedOffice], "pediatrics", "Casey Skin")).toEqual([]);
    expect(filterDoctorOffices([mixedOffice], "dermatology", "Casey Skin")).toEqual([mixedOffice]);
  });

  it("uses the documented monthly stale threshold", () => {
    expect(getDoctorOfficeFreshness(
      artifact,
      new Date("2026-09-20T12:00:00Z")
    )).toMatchObject({ ageDays: 38, isStale: false });
    expect(getDoctorOfficeFreshness(
      artifact,
      new Date("2026-10-01T12:00:00Z")
    )).toMatchObject({ ageDays: 49, isStale: true });
  });

});
