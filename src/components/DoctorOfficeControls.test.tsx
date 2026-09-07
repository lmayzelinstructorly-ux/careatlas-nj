import { useMemo, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  DoctorOfficeArtifact,
  DoctorOfficeLocation,
  DoctorOfficeSpecialtyId
} from "../types/doctorOffice";
import { filterDoctorOffices } from "../utils/doctorOfficeDiscovery";
import { DoctorOfficeControls } from "./DoctorOfficeControls";
import { DoctorOfficePanel, type OfficeGroup } from "./DoctorOfficeMarkers";

function makeOffice({
  city,
  displayName,
  id,
  providerName,
  specialtyId,
  zip
}: {
  city: string;
  displayName: string;
  id: string;
  providerName: string;
  specialtyId: DoctorOfficeSpecialtyId;
  zip: string;
}): DoctorOfficeLocation {
  return {
    addressLine1: "100 Test Avenue",
    addressLine2: null,
    addressPrecision: "building",
    city,
    countyFips: "013",
    displayName,
    id,
    latitude: 40.7,
    longitude: -74.1,
    phone: null,
    postalCode: zip,
    practiceNames: [displayName],
    providers: [{
      credentials: ["MD"],
      displayName: providerName,
      enrollmentIds: [id],
      groupNames: [displayName],
      normalizedSpecialtyIds: [specialtyId],
      npi: id.padEnd(10, "0").slice(0, 10),
      nppesStatus: "not_deactivated_in_snapshot",
      primarySpecialties: [
        specialtyId === "pediatrics" ? "PEDIATRIC MEDICINE" : "DERMATOLOGY"
      ],
      secondarySpecialties: []
    }],
    provenance: {
      censusGeocoderBenchmark: "fixture",
      censusGeocoderCheckedDate: "2026-08-30",
      censusGeocoderMatchedAddress: "fixture",
      censusGeocoderMatchType: "Exact",
      cmsAddressId: id,
      cmsDatasetId: "mj5m-pzi6",
      cmsReleaseDate: "2026-08-13",
      nppesCheckedDate: "2026-08-30",
      sourceRowIds: [id]
    },
    specialtyIds: [specialtyId],
    state: "NJ"
  };
}

const offices = [
  makeOffice({
    city: "Newark",
    displayName: "River Pediatrics",
    id: "office-1",
    providerName: "Jamie Rivera",
    specialtyId: "pediatrics",
    zip: "07102"
  }),
  makeOffice({
    city: "Trenton",
    displayName: "Capital Pediatrics",
    id: "office-2",
    providerName: "Alex Morgan",
    specialtyId: "pediatrics",
    zip: "08608"
  })
];

const artifact: DoctorOfficeArtifact = {
  coverage: {
    candidateOfficeCount: 3,
    explanation: "Fixture coverage is incomplete.",
    isComplete: false,
    officeCount: 2,
    providerCount: 2
  },
  generatedAt: "2026-08-30",
  limitations: ["Fixture only", "No availability", "No quality claims"],
  offices,
  publicationStatus: "validated_pilot",
  refreshPolicy: {
    cadence: "monthly",
    nextReviewDate: "2026-09-10",
    staleAfterDays: 45
  },
  schemaVersion: "1.0.0",
  sources: [{
    checkedDate: "2026-08-30",
    datasetId: "mj5m-pzi6",
    name: "CMS fixture",
    releaseDate: "2026-08-13",
    url: "https://example.test/cms"
  }],
  specialtyNormalizationVersion: "1.0.0",
  specialties: [{
    id: "pediatrics",
    label: "Pediatrics",
    officeCount: 2,
    providerCount: 2,
    sourceSpecialties: ["PEDIATRIC MEDICINE"]
  }],
  state: "NJ",
  stateFips: "34"
};

function ControlsHarness() {
  const [specialtyId, setSpecialtyId] =
    useState<DoctorOfficeSpecialtyId | null>(null);
  const [query, setQuery] = useState("");
  const matching = useMemo(
    () => filterDoctorOffices(offices, specialtyId, query),
    [query, specialtyId]
  );

  return <DoctorOfficeControls
    data={artifact}
    error=""
    loadState="ready"
    matchingOfficeCount={matching.length}
    onSearchQueryChange={setQuery}
    onSpecialtyChange={(nextSpecialty) => {
      setSpecialtyId(nextSpecialty);
      setQuery("");
    }}
    searchQuery={query}
    selectedSpecialtyId={specialtyId}
  />;
}

describe("DoctorOfficeControls", () => {
  it("labels the limited pilot and filters results through accessible controls", async () => {
    const user = userEvent.setup();
    render(<ControlsHarness />);

    expect(screen.getByRole("heading", { name: "Find a doctor's office" })).toBeVisible();
    expect(screen.queryByRole("searchbox", { name: "Search by ZIP, town or name" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Medical specialty"), "pediatrics");
    const search = screen.getByRole("searchbox", { name: "Search by ZIP, town or name" });
    expect(search).toHaveAttribute("placeholder", "Practice, city, ZIP, or provider");
    expect(screen.getByRole("status")).toHaveTextContent("2 pediatric office locations");
    expect(screen.getByRole("status")).toHaveTextContent("Select any number to see its list");

    await user.type(search, "Newark");
    expect(screen.getByRole("status")).toHaveTextContent("1 pediatric office location found");
    expect(screen.getByRole("status")).toHaveTextContent("Use the mouse wheel to zoom");
    await user.click(screen.getByRole("button", { name: "Clear doctor-office search" }));
    expect(search).toHaveValue("");
  });

  it("shows a load failure as an alert", () => {
    render(<DoctorOfficeControls
      data={null}
      error="Request failed"
      loadState="error"
      matchingOfficeCount={0}
      onSearchQueryChange={vi.fn()}
      onSpecialtyChange={vi.fn()}
      searchQuery=""
      selectedSpecialtyId={null}
    />);
    expect(screen.getByRole("alert")).toHaveTextContent("Request failed");
  });

  it("shows the historical-data warning after the documented threshold", () => {
    render(<DoctorOfficeControls
      data={{
        ...artifact,
        sources: [{
          ...artifact.sources[0],
          releaseDate: "2020-01-01"
        }]
      }}
      error=""
      loadState="ready"
      matchingOfficeCount={0}
      onSearchQueryChange={vi.fn()}
      onSpecialtyChange={vi.fn()}
      searchQuery=""
      selectedSpecialtyId={null}
    />);
    expect(screen.getByRole("status")).toHaveTextContent("Treat locations as historical");
  });
});

describe("DoctorOfficePanel", () => {
  it("acts as a keyboard-contained dialog and closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const group: OfficeGroup = {
      id: "fixture-group",
      label: null,
      latitude: offices[0].latitude,
      longitude: offices[0].longitude,
      offices: [offices[0]]
    };
    render(<DoctorOfficePanel
      focusedOfficeId={null}
      group={group}
      onClose={onClose}
      onShowOffice={vi.fn()}
      specialtyId="pediatrics"
    />);

    const dialog = screen.getByRole("dialog", { name: "River Pediatrics" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const closeButton = screen.getByRole("button", { name: "Close doctor office details" });
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByText("About this listing")).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps care actions prominent and record-heavy details collapsed", async () => {
    const user = userEvent.setup();
    const group: OfficeGroup = {
      id: "fixture-group",
      label: "Mercer County",
      latitude: offices[0].latitude,
      longitude: offices[0].longitude,
      offices
    };
    render(<DoctorOfficePanel
      focusedOfficeId={null}
      group={group}
      onClose={vi.fn()}
      onShowOffice={vi.fn()}
      specialtyId="pediatrics"
    />);

    expect(screen.getByRole("dialog", {
      name: "2 pediatric office locations in Mercer County"
    })).toBeVisible();
    expect(screen.getAllByRole("link", { name: /Get directions to/u })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Show on map" })).toHaveLength(2);

    const clinicianDetails = screen.getAllByText("See 1 clinician listed for this specialty")[0]
      .closest("details");
    const listingDetails = screen.getAllByText("About this listing")[0]
      .closest("details");
    expect(clinicianDetails).not.toHaveAttribute("open");
    expect(listingDetails).not.toHaveAttribute("open");

    await user.click(screen.getAllByText("See 1 clinician listed for this specialty")[0]);
    expect(clinicianDetails).toHaveAttribute("open");
  });
});
