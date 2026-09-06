# New Jersey town gap foundation

## Purpose

This foundation supports CareAtlas's conservative town-level view without
pretending that tract classifications automatically classify an entire town.
It connects the existing versioned tract screening results to the official New
Jersey county-subdivision boundaries and preserves partial-overlap information.

## Generated artifacts

- `public/data/tracts/nj/town-foundation/summary.json`
- `public/data/tracts/nj/town-foundation/by-county/{countyFips}.json`

The county shards are suitable for intent-driven loading. Each shard contains
its tract crosswalk rows and town screening-context records.

## Public town view

Selecting a town or township loads only that town's county shard. The default
card reports potential-gap and elevated-need counts as either:

- `primary-assigned tract areas`, when one or more tracts are assigned to the
  municipality; or
- `intersecting tract areas`, when a small municipality has no primary-assigned
  tract.

The card does not classify the municipality. Cross-boundary context, missing
evidence and the absence of primary-assigned tracts are explained through a
data-quality flag. Assignment and overlap details remain behind the optional
`See how town context is calculated` disclosure.

`View gap tracts` appears only when the town card reports at least one potential
gap tract. It opens only those flagged tracts. For towns with primary
assignments, it displays flagged primary-assigned tracts. For towns without a
primary assignment, it displays flagged intersecting tracts used by the card.

On desktop, a collapsed `Flagged tract areas in this town` list joins those
same GEOIDs to the validated public tract records. Each row shows the official
tract name and GEOID plus one plain-language reason derived from the published
screening findings. Selecting a row opens the existing tract map selection,
foreground highlight, brief and permalink flow. The list is not a ranking and
does not add a town classification. Mobile behavior is unchanged in this
phase.

Neutral county, town and non-gap tract context stays behind the visibly
highlighted potential-gap tracts. A single neutral town outline keeps the
selected boundary legible, and full tract polygons remain visible when they
cross it.

## Gap explorer

The public map keeps statewide discovery behind one `Explore potential gaps`
button. Its county list uses the versioned tract classification summary and is
alphabetical rather than ranked. Selecting a county lazily loads that county's
town-foundation shard and lists only municipalities with at least one flagged
primary-assigned or intersecting tract area. Selecting a town closes the
explorer and uses the existing boundary navigation and town card.

County and town counts are screening results, not scores. Town counts may
overlap when a tract intersects more than one municipality; the selected town
card provides the relevant data-quality explanation.

## Assignment and overlap methods

Primary assignment uses the official 2024 Census tract internal point within an
official 2024 county-subdivision polygon. This creates one primary town per
tract and prevents double counting. When the internal point is not contained,
the generator may use the largest equal-area polygon overlap only if that town
contains at least 25% of the tract polygon. Otherwise the tract stays
unassigned.

Polygon intersections use the official boundary coordinates projected into a
spherical Lambert azimuthal equal-area system centered on New Jersey. An
overlap is retained when it is the primary assignment or represents at least
0.5% of the tract polygon or town polygon. This catches meaningful partial
coverage while suppressing tiny topology slivers.

## Interpretation rules

- A town is never assigned an access-gap classification from these artifacts.
- Primary-assigned tract counts can be summed without double counting.
- Intersecting tract counts disclose partial context and can appear in more
  than one town.
- Polygon shares include land and water and are not population shares.
- Missing or unassigned evidence remains unknown and requires a visible data
  quality explanation in the public UI.
- Counts describe tract screening context, not residents, diagnoses, medical
  quality, provider quality or medical advice.

## Known data-quality findings

The initial foundation accounts for all 2,181 tracts and 564 towns. Seven
tracts remain unassigned under the conservative rule, including offshore or
very-low-overlap geometries. Forty small municipalities have intersecting tract
context but no tract internal point assigned to them. These are expected
quality flags for future town UI, not errors to fill with guessed values.
