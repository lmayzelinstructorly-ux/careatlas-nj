import type { GeographyLevel } from "../../geographyLayers";

export type MapPermalinkTarget = {
  geoid: string;
  kind: "county" | "town" | "tract";
};

const managedKeys = ["county", "town", "tract"] as const;

function isValidTarget(target: MapPermalinkTarget) {
  if (target.kind === "county") return /^34\d{3}$/.test(target.geoid);
  if (target.kind === "town") return /^34\d{8}$/.test(target.geoid);
  return /^34\d{9}$/.test(target.geoid);
}

export function parseMapPermalink(search: string): MapPermalinkTarget | null {
  const params = new URLSearchParams(search);
  const candidates: MapPermalinkTarget[] = [
    { geoid: params.get("tract") ?? "", kind: "tract" },
    { geoid: params.get("town") ?? "", kind: "town" },
    { geoid: params.get("county") ?? "", kind: "county" }
  ];

  return candidates.find((candidate) => isValidTarget(candidate)) ?? null;
}

export function getMapPermalinkTarget(
  level: GeographyLevel,
  geoid: string | null | undefined
): MapPermalinkTarget | null {
  if (!geoid) return null;

  const kind: MapPermalinkTarget["kind"] | null =
    level === "counties"
      ? "county"
      : level === "towns"
        ? "town"
        : level === "tracts"
          ? "tract"
          : null;
  const target: MapPermalinkTarget | null = kind ? { geoid, kind } : null;

  return target && isValidTarget(target) ? target : null;
}

export function buildMapPermalinkUrl(
  target: MapPermalinkTarget | null,
  currentUrl: string
) {
  const url = new URL(currentUrl);

  for (const key of managedKeys) url.searchParams.delete(key);
  if (target) url.searchParams.set(target.kind, target.geoid);
  url.hash = "";

  return url;
}

export function replaceMapPermalink(target: MapPermalinkTarget | null) {
  const url = buildMapPermalinkUrl(target, window.location.href);
  window.history.replaceState(window.history.state, "", url);
}
