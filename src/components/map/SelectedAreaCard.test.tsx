import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { SelectedAreaCard, type SelectedAreaCardProps } from "./SelectedAreaCard";
import { useTownGapContext } from "../../hooks/useTownGapContext";
import type { TownTractScreeningContext } from "../../types/townGapContext";
import essex from "../../../public/data/tracts/nj/town-foundation/by-county/013.json";

vi.mock("../../hooks/useTownGapContext", () => ({ useTownGapContext: vi.fn() }));
vi.mock("../../hooks/useCountyGapSummary", () => ({ useCountyGapSummary: () => ({ counts: null, loadState: "idle" }) }));
vi.mock("../../hooks/useTractPublicRecord", () => ({ useTractPublicRecord: () => ({ record: null, loadState: "idle" }) }));
vi.mock("../../hooks/useTownFlaggedTracts", () => ({ useTownFlaggedTracts: () => ({ records: [], loadState: "ready" }) }));

const newark = essex.towns.find((town) => town.geography.geoid === "3401351000") as TownTractScreeningContext;
function useRecord(record: TownTractScreeningContext | null, error: string | null = null) {
  vi.mocked(useTownGapContext).mockReturnValue({ record, error, loadState: error ? "error" : "ready", limitations: [], ruleVersion: "1.0.0", tractGeoids: [] });
}
function props(): SelectedAreaCardProps {
  return {
    activeTractCounty: null, activeTractTown: null, facilities: [], facilityLoadState: "ready", tractMode: false,
    selectedGeography: { geoid: "3401351000", countyFips: "013", level: "towns", name: "Newark City", latitude: 40.7, longitude: -74.2 },
    onBackToSummary: vi.fn(), onClear: vi.fn(), onCloseTractMode: vi.fn(), onOpenTractMode: vi.fn(), onSelectFlaggedTract: vi.fn()
  };
}
beforeEach(() => { vi.restoreAllMocks(); useRecord(structuredClone(newark)); window.history.replaceState(null, "", "/?mode=gaps"); });

it("shows the supplied Newark counts in plain language and discloses the assignment method on request", async () => {
  const user = userEvent.setup();
  const actions = props();
  render(<SelectedAreaCard {...actions} />);
  expect(screen.getByRole("region", { name: "Newark City" })).toBeVisible();
  expect(screen.getByText(/66 of the 88 census tracts assigned to Newark.*were flagged/)).toBeVisible();
  const method = screen.getByText(/The technical term “primary-assigned”/);
  expect(method).not.toBeVisible();
  await user.click(screen.getByText("See how town context is calculated"));
  expect(method).toBeVisible();
  await user.click(screen.getByRole("button", { name: "View gap tracts" }));
  expect(actions.onOpenTractMode).toHaveBeenCalledWith(actions.selectedGeography);
  await user.click(screen.getByRole("button", { name: "Clear selected area" }));
  expect(actions.onClear).toHaveBeenCalledOnce();
});

it("copies the official town link and prints the current brief", async () => {
  const user = userEvent.setup();
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  render(<SelectedAreaCard {...props()} />);
  await user.click(screen.getByRole("button", { name: "Copy link" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Link copied.");
  const shared = new URL(await navigator.clipboard.readText());
  expect(shared.searchParams.get("town")).toBe("3401351000");
  expect(shared.searchParams.get("mode")).toBe("gaps");
  await user.click(screen.getByRole("button", { name: "Print brief" }));
  expect(print).toHaveBeenCalledOnce();
});

it("explains a zero flag and missing evidence without implying adequate access", async () => {
  const record = structuredClone(newark);
  record.tractContext.primaryAssignedTractCount = 2;
  record.tractContext.screeningStateCountsForPrimaryAssignedTracts = { potential_access_gap: 0, insufficient_evidence: 1, elevated_need_without_documented_shortage: 0, no_current_gap_flag: 1 };
  record.dataQuality.hasInsufficientEvidence = true;
  useRecord(record);
  const user = userEvent.setup();
  render(<SelectedAreaCard {...props()} />);
  expect(screen.getByText(/None of these tract areas met both parts/)).toHaveTextContent("or prove that access is adequate");
  expect(screen.queryByRole("button", { name: "View gap tracts" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Print brief" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Explain town data limitations" }));
  expect(screen.getByText(/missing required evidence/)).toBeVisible();
});

it("labels overlap counts when no tract is assigned to the town", () => {
  const record = structuredClone(newark);
  record.dataQuality.hasPrimaryAssignedTracts = false;
  useRecord(record);
  render(<SelectedAreaCard {...props()} />);
  expect(screen.getByText(/census tracts overlapping Newark.*were flagged/)).toBeVisible();
});

it("shows a load error instead of invented counts", () => {
  useRecord(null, "Town data could not be loaded.");
  render(<SelectedAreaCard {...props()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Town data could not be loaded.");
  expect(screen.queryByText(/census tracts assigned to/)).not.toBeInTheDocument();
});
