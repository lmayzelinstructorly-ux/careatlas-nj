import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoundaryAutocomplete } from "./BoundaryAutocomplete";
import { AddressTractFinder } from "./AddressTractFinder";
import townSource from "../../../public/data/cousubs/by-state/34.geojson?raw";

const towns = JSON.parse(townSource);
afterEach(() => { vi.unstubAllGlobals(); });

describe("place suggestions with official NJ boundaries", () => {
  it.each([
    ["nwark", "Newark City"], ["ed", "Edison Township"],
    ["ediosn", "Edison Township"], ["jersey ci", "Jersey City"],
    ["newark city nj", "Newark City"], ["piscatway", "Piscataway Township"]
  ])("suggests %s without submitting", async (query, expected) => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BoundaryAutocomplete countyData={null} townData={towns} onSelect={onSelect} />);
    await user.type(screen.getByRole("combobox"), query);
    expect(screen.getAllByRole("option")[0]).toHaveTextContent(expected);
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ displayName: expected }));
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");
  });

  it("closes an empty result with Escape and distinguishes loading from no match", async () => {
    const user = userEvent.setup();
    const view = render(<BoundaryAutocomplete countyData={null} townData={null} onSelect={vi.fn()} />);
    await user.type(screen.getByRole("combobox"), "zzzzzzz");
    expect(screen.getByText(/still loading/)).toBeVisible();
    view.rerender(<BoundaryAutocomplete countyData={null} townData={towns} onSelect={vi.fn()} />);
    expect(screen.getByText(/No New Jersey/)).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
  });
});

function renderAddress(onLocationMatch = vi.fn()) {
  render(<AddressTractFinder onClear={vi.fn()} onLocationMatch={onLocationMatch} resolution={{ status: "idle", message: null }} />);
  return screen.getByRole("combobox");
}
const response = (suggestions: { text: string; magicKey: string }[]) => ({ ok: true, json: async () => ({ suggestions }) });

describe("address request lifecycle", () => {
  it("requests partial text without requiring a number and selects by keyboard", async () => {
    const user = userEvent.setup();
    const onMatch = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce(response([{ text: "Main Street, Newark, NJ", magicKey: "one" }]))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ match: { address: "Main Street, Newark, NJ" } }) });
    vi.stubGlobal("fetch", fetchMock);
    const input = renderAddress(onMatch);
    await user.type(input, "Ma");
    await screen.findByRole("option");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ query: "Ma" });
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onMatch).toHaveBeenCalledOnce());
  });

  it("ignores out-of-order suggestions even if transport does not honor abort", async () => {
    const user = userEvent.setup();
    let finishOld!: (value: unknown) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValue(response([{ text: "New result, Edison, NJ", magicKey: "new" }]));
    vi.stubGlobal("fetch", fetchMock);
    const input = renderAddress();
    await user.type(input, "10 Old");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await user.clear(input);
    await user.type(input, "20 New");
    await screen.findByRole("option", { name: "New result, Edison, NJ" });
    await act(async () => finishOld(response([{ text: "Old result, Newark, NJ", magicKey: "old" }])));
    expect(screen.queryByRole("option", { name: /Old result/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /New result/ })).toBeVisible();
  });

  it("does not restore a selected location after the user edits the address", async () => {
    const user = userEvent.setup();
    let finishGeocode!: (value: unknown) => void;
    const onMatch = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response([{ text: "10 Main Street, Newark, NJ", magicKey: "one" }]))
      .mockImplementationOnce(() => new Promise(resolve => { finishGeocode = resolve; }))
      .mockResolvedValue(response([])));
    const input = renderAddress(onMatch);
    await user.type(input, "10 Main");
    await user.click(await screen.findByRole("option"));
    await user.clear(input);
    await user.type(input, "20 Other");
    await act(async () => finishGeocode({ ok: true, json: async () => ({ match: { address: "10 Main Street, Newark, NJ" } }) }));
    expect(onMatch).not.toHaveBeenCalled();
    expect(input).toHaveValue("20 Other");
  });
});
