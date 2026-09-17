import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import MapPage from "./MapPage";

// Leaflet geometry is exercised in browser QA; this checks the real header and mode state.
vi.mock("../components/CareAtlasMap", () => ({ default: ({ mapMode }: { mapMode: string }) => <p role="status">Map mode: {mapMode}</p> }));
beforeEach(() => window.history.replaceState(null, "", "/"));

it("starts with facilities and preserves a selected map mode on refresh", async () => {
  const user = userEvent.setup();
  const view = render(<MemoryRouter><MapPage /></MemoryRouter>);
  expect(await screen.findByRole("status")).toHaveTextContent("Map mode: healthcare");
  expect(new URLSearchParams(window.location.search).get("mode")).toBe("healthcare");
  await user.click(screen.getByRole("button", { name: "Potential gaps" }));
  expect(screen.getByRole("status")).toHaveTextContent("Map mode: gaps");
  view.unmount();
  render(<MemoryRouter><MapPage /></MemoryRouter>);
  expect(await screen.findByRole("status")).toHaveTextContent("Map mode: gaps");
});

it.each(["/?town=3401351000", "/?tract=34013000100", "/?county=34013", "/?mode=healthcare&tract=34013000100"])("restores tract and legacy area link %s in gap mode", async (url) => {
  window.history.replaceState(null, "", url);
  render(<MemoryRouter><MapPage /></MemoryRouter>);
  expect(await screen.findByRole("status")).toHaveTextContent("Map mode: gaps");
});

it.each([
  ["/?mode=healthcare&town=3401351000", "healthcare", "town", "3401351000"],
  ["/?mode=doctor-offices&county=34013", "doctor_offices", "county", "34013"]
])("keeps the selected place in an explicit mode link %s", async (url, mode, key, geoid) => {
  window.history.replaceState(null, "", url);
  const user = userEvent.setup();
  render(<MemoryRouter><MapPage /></MemoryRouter>);
  expect(await screen.findByRole("status")).toHaveTextContent(`Map mode: ${mode}`);
  await user.click(screen.getByRole("button", { name: "Potential gaps" }));
  expect(new URLSearchParams(window.location.search).get(key)).toBe(geoid);
});
