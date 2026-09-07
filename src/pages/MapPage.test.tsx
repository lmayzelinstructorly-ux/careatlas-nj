import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import MapPage from "./MapPage";

// Leaflet geometry is exercised in browser QA; this checks the real header and mode state.
vi.mock("../components/CareAtlasMap", () => ({ default: ({ mapMode }: { mapMode: string }) => <p role="status">Map mode: {mapMode}</p> }));
beforeEach(() => window.history.replaceState(null, "", "/"));

it("starts in gaps and preserves an explicitly selected facility mode on refresh", async () => {
  const user = userEvent.setup();
  const view = render(<MemoryRouter><MapPage /></MemoryRouter>);
  expect(await screen.findByRole("status")).toHaveTextContent("Map mode: gaps");
  await user.click(screen.getByRole("button", { name: "Hospitals & community health centers" }));
  expect(screen.getByRole("status")).toHaveTextContent("Map mode: healthcare");
  expect(new URLSearchParams(window.location.search).get("mode")).toBe("healthcare");
  view.unmount();
  render(<MemoryRouter><MapPage /></MemoryRouter>);
  expect(await screen.findByRole("status")).toHaveTextContent("Map mode: healthcare");
});

it.each(["/?town=3401351000", "/?tract=34013000100", "/?county=34013"])("restores legacy area link %s in gap mode", async (url) => {
  window.history.replaceState(null, "", url);
  render(<MemoryRouter><MapPage /></MemoryRouter>);
  expect(await screen.findByRole("status")).toHaveTextContent("Map mode: gaps");
});
