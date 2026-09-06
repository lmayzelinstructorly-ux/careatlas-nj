# Healthcare row-level evidence

Limited row-level evidence is official HRSA/CMS metadata copied from a source row for a specific facility record. CareAtlas may use it to reduce blank display states when the source proves that a facility has limited planning context, but not enough detail for full access scoring.

## What it can support

- Display-only planning context.
- Testing and audit coverage counts.
- A clearly labeled "Limited row-level display score" when the record has enough display coverage.
- Weekly operating hours metadata when an official row says, for example, "HRSA operating hours per week: 40.00".
- A facility type/site type signal when official row-level provenance supports it.

## What it cannot support

- Daily hours.
- Specific service lists.
- Ranking or comparison.
- Medical quality claims.
- Medical advice.
- Invented prices, insurance details, coordinates, addresses, services or hours.

## Why weekly hours are not daily hours

Weekly operating hours say only how many hours a facility is open across a week. They do not say which days the facility is open, opening times, closing times, weekend availability or holiday exceptions. CareAtlas therefore shows weekly hours separately as metadata and never converts them into Monday-through-Sunday fields.

## Why facility type is not a service list

A facility type or site type can help users understand the kind of public health facility represented by the row. It does not prove that specific services are offered at that location. CareAtlas therefore shows it separately as a "facility type/site type signal" and never copies it into `services[]`.

## Why these signals are display-only

Limited row-level evidence can make a record less blank for public health planning, but it is weaker than fully verified facility fields. It must stay clearly labeled and must not be used to rank or compare facilities.
