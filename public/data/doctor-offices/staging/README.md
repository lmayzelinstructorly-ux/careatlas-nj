# Doctor-office unmatched-geocode review

`npm run import:doctor-offices` writes
`unmatched-geocodes.review.json` here. The generated packet is ignored by Git
and forbidden from the production bundle. It contains only source-backed CMS
practice-location context that the official Census batch geocoder did not
match.

List pending records:

```bash
npm run review:doctor-office-geocodes
```

Inspect one record:

```bash
npm run review:doctor-office-geocodes -- --id=<record-id>
```

Annotate a source-address review only with an official evidence URL:

```bash
npm run review:doctor-office-geocodes -- --id=<record-id> --status=source_address_confirmed --evidence-url=<official-url> --notes=<review-note>
```

Review annotations never add coordinates and never promote a record. A
location remains excluded until a later official-source import receives an
accepted Census geocode inside exactly one official New Jersey county.
