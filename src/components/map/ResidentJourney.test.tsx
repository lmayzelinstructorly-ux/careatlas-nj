import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PurposeDialog } from "../PurposeDialog";
import { GapSidebar } from "./GapSidebar";
import { AddressTractFinder } from "./AddressTractFinder";
import { newarkExampleUrl } from "./mapExamples";
import townData from "../../../public/data/cousubs/by-state/34.geojson?raw";

// The search runs against the supplied official town boundaries, not invented places.
const towns = JSON.parse(townData);
beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("resident entry points", () => {
  it("offers a real example and dismisses the welcome for the rest of the session", async () => {
    const user = userEvent.setup();
    const view = render(<MemoryRouter><PurposeDialog /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Explore an example: Newark" })).toHaveAttribute("href", newarkExampleUrl);
    await user.click(screen.getByRole("button", { name: "Search a town" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
    render(<MemoryRouter><PurposeDialog /></MemoryRouter>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([newarkExampleUrl, "/?tract=34013000100", "/story"])("opens %s without interrupting the destination", (url) => {
    render(<MemoryRouter initialEntries={[url]}><PurposeDialog /></MemoryRouter>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("contains keyboard focus and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PurposeDialog /></MemoryRouter>);
    screen.getByRole("link", { name: "See project decisions" }).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Search a town" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("town-first search", () => {
  it("selects Newark by keyboard and lets residents reopen search after a result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ stateCountsByCounty: {}, counties: [] }) }));
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const props = {
      addressResolution: { status: "idle" as const, message: null },
      countyData: null,
      onAddressClear: vi.fn(),
      onAddressLocationMatch: vi.fn(),
      onSelect,
      townData: towns
    };
    const view = render(<GapSidebar {...props} selectionId={null}><p>Result</p></GapSidebar>);
    const search = screen.getByRole("combobox", { name: "Search New Jersey counties, towns, and townships" });
    await user.type(search, "Newark");
    expect(screen.getByRole("option", { name: /Newark City/ })).toBeVisible();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ level: "towns", feature: expect.objectContaining({ properties: expect.objectContaining({ GEOID: "3401351000" }) }) }));
    view.rerender(<GapSidebar {...props} selectionId="3401351000"><h2>Newark result</h2></GapSidebar>);
    await waitFor(() => expect(search).not.toBeVisible());
    expect(screen.getByRole("heading", { name: "Newark result" })).toBeVisible();
    await user.click(screen.getByText("Choose another place"));
    expect(
      screen.getByRole("combobox", {
        name: "Search New Jersey counties, towns, and townships"
      })
    ).toBeVisible();
  });

  it("distinguishes same-name municipalities and explains an unmatched search", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ stateCountsByCounty: {}, counties: [] }) }));
    const user = userEvent.setup();
    render(
      <GapSidebar
        addressResolution={{ status: "idle", message: null }}
        countyData={null}
        onAddressClear={vi.fn()}
        onAddressLocationMatch={vi.fn()}
        onSelect={vi.fn()}
        selectionId={null}
        townData={towns}
      >
        {null}
      </GapSidebar>
    );
    const search = screen.getByRole("combobox", {
      name: "Search New Jersey counties, towns, and townships"
    });
    await user.type(search, "Pemberton");
    expect(screen.getByRole("option", { name: /Pemberton Borough/ })).toBeVisible();
    expect(screen.getByRole("option", { name: /Pemberton Township/ })).toBeVisible();
    await user.clear(search);
    await user.type(search, "zzzz-nonexistent");
    expect(screen.getByText(/No New Jersey county or town matches/)).toBeVisible();
  });
});

describe("optional address lookup", () => {
  it("reports a failed lookup without producing a location result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Address service unavailable. Try again later." }) }));
    const user = userEvent.setup();
    const onMatch = vi.fn();
    render(<AddressTractFinder onClear={vi.fn()} onLocationMatch={onMatch} resolution={{ status: "idle", message: null }} />);
    await user.type(screen.getByRole("combobox"), "123 Test Street");
    const region = screen.getByRole("region", {
      name: "Search for a New Jersey town or address"
    });
    expect((await within(region).findAllByText(/Address service unavailable/)).length).toBeGreaterThan(0);
    expect(onMatch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Clear address search" }));
    expect(screen.getByRole("combobox")).toHaveValue("");
  });
});
