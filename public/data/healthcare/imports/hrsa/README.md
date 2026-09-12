# Regional HRSA Imports

Keep each official HRSA state CSV in its own lowercase state folder:

```text
public/data/healthcare/imports/hrsa/<state>/
```

For example, Pennsylvania belongs at
`public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv` and New York belongs at
`public/data/healthcare/imports/hrsa/ny/hrsa-ny.csv`.

These folders are source intake areas, not production data. Do not add sample
rows, guessed coordinates, or manually invented fields. Use the regional
workflow in `docs/healthcare-data-workflow.md` to review, stage, approve, and
promote one state at a time.
