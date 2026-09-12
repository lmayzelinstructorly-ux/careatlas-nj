# HRSA Refresh NJ Additions Manual-Review Worksheet - 2026-06-24

> Review-only worksheet. This file does not stage, promote, remove, approve, regenerate, or update production healthcare records.

## Inputs Reviewed

- Audit report: `docs/reports/hrsa-refresh-audit-2026-06-24.md`
- Review packet: `docs/reports/hrsa-refresh-review-packet-2026-06-24.md`
- Official CSV: `public/data/healthcare/imports/hrsa/refresh/hrsa-official-2026-06-24.csv`
- Production comparison file: `public/data/healthcare/facilities.json`
- Scope: NJ upstream additions first, plus the two production records missing from the scoped upstream audit.

## NJ Additions Summary

- NJ additions reviewed: 30
- Low risk: 3
- Medium risk: 16
- High risk: 4
- Hold: 7
- No item below is approved for promotion. "Likely safe to stage later" means the record can be considered for a future staging review only after manual source checks.

## NJ Additions Review Table

| Source ID | Facility/site name | Address | City | ZIP/postal code | Latitude/longitude | Phone | Website | Nearest or most similar existing production record | Similarity reason | Risk level | Recommended manual review action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `BPS-H80-008812` | North Hudson Community Action Corporation- Corporate Headquarters | 800 31st St | Union City | 07087-2428 | 40.77374897, -74.03355131 | 201-210-0100 | nhcac.org | `BPS-H80-035398` - North Hudson Community Action Corporation @ Secaucus; 55 Meadowlands Pkwy, Secaucus, NJ 07094-2977 | same organization; similar phone; similar name; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-LAL-039367` | Star Community Health | 388 Memorial Pkwy | Phillipsburg | 08865-1535 | 40.69537716, -75.1900066 | 908-847-5630 | Starcommunityhealth.org | `BPS-LAL-037089` - Star Community Health-Coventry; 755 Memorial Pkwy, Ste 300, Phillipsburg, NJ 08865-2748 | similar name; similar website/domain; nearby coordinate; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-003788` | METROPOLITAN FAMILY HEALTH NETWORK | 935 Garfield Ave | Jersey City | 07304-2731 | 40.71103649, -74.07064358 | 201-478-5802 | www.metrofhn.com | `BPS-H80-001532` - Metropolitan Family Health Network, Inc. at West New York; 5300 Bergenline Ave, West New York, NJ 07093-5616 | same organization; similar website/domain; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-004971` | NEWARK COMMUNITY HEALTH CENTERS, INC. | 741 Broadway | Newark | 07104-4390 | 40.77519044, -74.15875968 | 973-483-1300 | www.nchcfqhc.org | `BPS-H80-034310` - Newark Community Health Centers - Mobile Unit; 741 Broadway, Newark, NJ 07104-4390 | same address; similar name; similar phone; similar website/domain; nearby coordinate; coordinate near border/boundary in packet | hold | likely duplicate/hold |
| `BPS-H80-008251` | CHEMED | 1771 Madison Ave | Lakewood | 08701-1242 | 40.10883698, -74.21761296 | 732-364-2144 | _(missing)_ | `BPS-H80-039775` - Mobile Van; 1771 Madison Ave, Lakewood, NJ 08701-1242 | same address; similar phone; nearby coordinate; missing website | hold | likely duplicate/hold |
| `BPS-H80-005615` | Kids' Center at Downe Twp. Elementary School | 220 County Highway 553 | Newport | 08345-2129 | 39.2971, -75.1653 | 856-451-4700 | www.completecarenj.org | `BPS-H80-032546` - CompleteCare Medical & Dental Professionals; 530 High St N, Millville, NJ 08332-3009 | same organization; similar phone; similar website/domain; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-034033` | AtlantiCare Health Services - FQHC Administration | 1401 Atlantic Ave STE 1125 | Atlantic City | 08401-7001 | 39.36182953, -74.42891169 | 609-572-6002 | www.atlanticare.org | `BPS-H80-027862` - AtlantiCare Health Services - Wellness Center; 1401 Atlantic Ave, Atlantic City, NJ 08401-7001 | same organization; similar name; nearby coordinate; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-039294` | VNACJ Community Health Center, Inc. Administration | 3600 State Route 66 | Neptune | 07753-2645 | 40.22146394, -74.08748257 | 732-502-5117 | _(missing)_ | No close production match found in the NJ production comparison | missing website; coordinate near border/boundary in packet | medium | missing critical source details/hold until website/source details are checked |
| `BPS-H80-007901` | Central Jersey Medical Center | 275 Hobart St | Perth Amboy | 08861-3396 | 40.50851399, -74.26954497 | 732-376-9333 | www.jrmc.us | `BPS-H80-013660` - Central Jersey Medical Center Mobile Van 2; 275 Hobart St, Perth Amboy, NJ 08861-3396 | same address; similar phone; similar website/domain; nearby coordinate; coordinate near border/boundary in packet | hold | likely duplicate/hold |
| `BPS-H80-041425` | KIPP: Cooper Norcross | 525 Clinton St | Camden | 08103-1223 | 39.93887776, -75.11974538 | 856-968-2320 | _(missing)_ | `BPS-H80-012729` - VOA Liberty Street Facility; 510 Liberty St, Camden, NJ 08104-1112 | similar phone; nearby coordinate; missing website; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-001408` | Henry J. Austin Health Center-Warren | 321 N Warren St | Trenton | 08618-4794 | 40.2253842, -74.76541786 | 609-278-5900 | www.henryjaustin.org | `BPS-H80-024564` - Henry J Austin Health Center - Mobile Health Unit; 218 N Broad St, Trenton, NJ 08608-1306 | same organization; similar name; similar phone; nearby coordinate; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-032725` | CompleteCare Health Network | 14 N Pearl St | Bridgeton | 08302-1902 | 39.42941499, -75.23302303 | 856-451-4700 | www.completecarenj.org | `BPS-H80-017765` - CompleteCare Medical Professionals; 717 Delsea Dr, Pitman, NJ 08071 | same organization; similar name; similar phone; similar website/domain; packet same/similar address flag needs manual confirmation | high | verify exact site first |
| `BPS-H80-017286` | Project H.O.P.E. West Street Health Center | 519-525 West St | Camden | 08103 | 39.93903701, -75.122485 | 856-968-2320 | _(missing)_ | `BPS-H80-012729` - VOA Liberty Street Facility; 510 Liberty St, Camden, NJ 08104-1112 | similar phone; nearby coordinate; missing website; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-032492` | Jewish Renaissance Foundation, Inc. | 1090 King Georges Post Rd, Suite 704 | Edison | 08837-3722 | 40.5234088, -74.32688523 | 732-324-2114 | _(missing)_ | `BPS-H80-018693` - Jewish Renaissance Foundation Community Health Center; 1931 Oak Tree Rd, Edison, NJ 08820-2072 | same organization; same/similar name; missing website; coordinate near border/boundary in packet | high | verify exact site first |
| `BPS-H80-037717` | Saint James Health 255 Admin | 255 Lafayette St | Newark | 07105-2125 | 40.72858069, -74.16095951 | 973-679-6846 | _(missing)_ | `BPS-LAL-037722` - Outreach Site; 255 Lafayette St, Newark, NJ 07105-2125 | same address; nearby coordinate; missing website; coordinate near border/boundary in packet | hold | likely duplicate/hold |
| `BPS-H80-008888` | CAMcare Riverview | 130 Mickle Blvd | Camden | 08103-1025 | 39.94240737, -75.12664595 | 856-541-6359 | www.camcare.net | `BPS-H80-000131` - CAMCARE - NORTH HEALTH CENTER; N 6th St & Erie St, Camden, NJ 08102 | same organization; similar website/domain; nearby coordinate; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-035341` | Southern Jersey Family Medical Centers, Inc. | 1 Executive Drive | Marlton | 08053 | 39.87051089, -74.9235806 | 609-481-3116 | www.sjfmc.org | `BPS-H80-003387` - Hammonton - SOUTHERN JERSEY FAMILY MEDICAL; 860 S White Horse Pike, Hammonton, NJ 08037-2030 | same organization; similar website/domain; no packet risk flag | low | likely safe to stage later |
| `BPS-H80-038343` | Rutgers RWJ Eric B. Chandler Health Center | 277 George St | New Brunswick | 08901-1476 | 40.49173074, -74.44251627 | 732-235-6700 | _(missing)_ | `BPS-H80-038345` - Rutgers RWJ Eric B. Chandler Health Center; 123 Church St, New Brunswick, NJ 08901-2001 | same name; nearby coordinate; missing website | high | verify exact site first |
| `BPS-H80-019637` | Saint James Health, Inc. | 228 Lafayette St | Newark | 07105-1815 | 40.72890972, -74.16278031 | 973-789-8111 | _(missing)_ | `BPS-H80-017493` - Saint James Health, Inc.; 228 Lafayette St, Newark, NJ 07105-1815 | same address; same name; same organization; similar phone; nearby coordinate; missing website; coordinate near border/boundary in packet | hold | likely duplicate/hold |
| `BPS-H80-000725` | Mary Eliza Mahoney Health Center | 394 University Ave | Newark | 07102-1246 | 40.73413198, -74.17751201 | 800-734-7083 | _(missing)_ | `BPS-H80-037818` - Mary Eliza Mahoney Health Center Mobile Unit #3; 394 University Ave, Newark, NJ 07102-1221 | same address; similar name; similar phone; nearby coordinate; missing website; coordinate near border/boundary in packet | hold | likely duplicate/hold |
| `BPS-H80-035726` | One Port Center | 2 Riverside Dr | Camden | 08103-1054 | 39.94438701, -75.13007147 | 856-583-2400 | _(missing)_ | No close production match found in the NJ production comparison | missing website; coordinate near border/boundary in packet | medium | missing critical source details/hold until website/source details are checked |
| `BPS-H80-018011` | Lakewood | 212 2nd St | Lakewood | 08701-3424 | 40.09231449, -74.21273427 | 845-354-9300 | _(missing)_ | `BPS-H80-002970` - OCEAN HEALTH INITIATIVES LAKEWOOD SITE; 101 2nd St, Lakewood, NJ 08701-3324 | nearby coordinate; missing website | medium | verify exact site first |
| `BPS-H80-034397` | Henry J. Austin Health Center-Nottingham | 1931 Nottingham Way | Trenton | 08619-3554 | 40.23292762, -74.71025152 | 609-278-5900 | _(missing)_ | `BPS-H80-024564` - Henry J Austin Health Center - Mobile Health Unit; 218 N Broad St, Trenton, NJ 08608-1306 | same organization; similar name; similar phone; missing website; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-001082` | CAMCARE - GATEWAY HEALTH CENTER | 817 Federal St | Camden | 08103-1539 | 39.94422671, -75.11558645 | 856-541-3270 | WWW.CAMCARE.NET | `BPS-H80-008508` - CAMcare Odessa Paulk-Jones Health Center; 813 Ferry Ave, Camden, NJ 08104-1824 | same organization; similar phone; similar website/domain; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-032726` | CompleteCare Health Network | 1020 High St N | Millville | 08332-2527 | 39.40957532, -75.04113117 | 856-451-4700 | www.completecarenj.org | `BPS-H80-017765` - CompleteCare Medical Professionals; 717 Delsea Dr, Pitman, NJ 08071 | same organization; similar name; similar phone; similar website/domain; no packet risk flag | low | likely safe to stage later |
| `BPS-H80-041422` | CAMcare Mobile Unit | 1420 Crestmont Ave | Camden | 08103-3182 | 39.92762698, -75.09866799 | 856-583-2400 | _(missing)_ | `BPS-H80-036679` - CompleteCare Mobile Medical Unit; 785 W Sherman Ave, Vineland, NJ 08360-6913 | similar name; missing website; coordinate near border/boundary in packet | medium | verify exact site first |
| `BPS-H80-003137` | Colt Connection at Cumberland Regional High School | 65 Love Ln | Bridgeton | 08302-6076 | 39.4716, -75.21829999 | 856-451-9400 x279 | www.completecarenj.org | `BPS-H80-004925` - Teen Center at Bridgeton High School; 111 Northwest Ave, Bridgeton, NJ 08302 | same organization; similar website/domain; nearby coordinate under 1 mile; no packet risk flag | low | likely safe to stage later |
| `BPS-H80-028090` | CompleteCare Health Network | 905 W Main St | Millville | 08332-4519 | 39.39797318, -75.05968552 | 856-451-4700 | _(missing)_ | `BPS-H80-017765` - CompleteCare Medical Professionals; 717 Delsea Dr, Pitman, NJ 08071 | same organization; similar name; similar phone; missing website | medium | verify exact site first |
| `BPS-H80-004219` | Zufall Health Center | 18 W Blackwell St | Dover | 07801-3841 | 40.88386014, -74.55970776 | 973-328-9100 | WWW.zufallhealth.org | `BPS-H80-040694` - Zufall Health Mobile Medical; 18 W Blackwell St, Dover, NJ 07801-3841 | same address; similar name; similar website/domain; nearby coordinate | hold | likely duplicate/hold |
| `BPS-H80-036171` | Alliance Community Healthcare Inc. Administrative Offices | 26 Journal Sq, Suite 1600 | Jersey City | 07306-3847 | 40.7304442, -74.06372298 | 201-451-6300 | www.alliancech.org | `BPS-H80-011078` - Alliance Community Healthcare, Inc.; 115 Christopher Columbus Dr, Jersey City, NJ 07302-5526 | same organization; same/similar name; similar website/domain; coordinate near border/boundary in packet | high | verify exact site first |

## Missing-Upstream Review

| State | Source ID | Production name | Production address | Phone/website | Source metadata | Upstream replacement or rename signal | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NY | `BPS-H80-003698` | BROOKLYN PLAZA MEDICAL CENTER, INC. | 650 Fulton St, Brooklyn, NY 11217-1517 | phone=718-596-9800; website=www.brooklynplaza.org | sourceName=HRSA Health Center Service Delivery and Look-Alike Sites; sourceUrl=https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv; sourceLastUpdated=2026-06-19; lastChecked=2026-06-19; lastVerified=2026-06-19 | No same-source-ID row found in the official 2026-06-24 CSV. `BPS-H80-041628` is an upstream and production Brooklyn Plaza record at 1089 President St with the same phone/domain and organization address at 650 Fulton St, but it is already a distinct production record and should not be treated as an automatic replacement. | do not remove automatically; verify HRSA history/source; check closure, merge, source ID change, or upstream data issue |
| CT | `BPS-H80-010657` | OPTIMUS at Inspirica | 8 Woodland Pl, Stamford, CT 06902-6939 | phone=203-388-0170; website=_(missing)_ | sourceName=HRSA Health Center Service Delivery and Look-Alike Sites; sourceUrl=https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv; sourceLastUpdated=2026-06-19; lastChecked=2026-06-19; lastVerified=2026-06-19 | The same source ID appears in the official 2026-06-24 CSV, but with blank site address/city/postal/coordinates and state `XX` / Not Determined, so it falls out of the CT-scoped audit. Nearby Stamford OPTIMUS records do not look like exact replacements. | do not remove automatically; verify HRSA history/source; check closure, merge, source ID change, or upstream data issue |

## High-Risk Additions Summary

### NJ Duplicate or Address-Match Holds

- `BPS-H80-004971` - same address as `BPS-H80-034310`; same/similar Newark Community Health Centers identity and contact details.
- `BPS-H80-008251` - same address and phone as `BPS-H80-039775`; website is missing.
- `BPS-H80-007901` - same address and contact/domain match as `BPS-H80-013660`.
- `BPS-H80-037717` - same address as `BPS-LAL-037722`; website is missing.
- `BPS-H80-019637` - same address, name, phone and coordinate as `BPS-H80-017493`; website is missing.
- `BPS-H80-000725` - same address and phone as `BPS-H80-037818`; website is missing.
- `BPS-H80-004219` - same address/domain as `BPS-H80-040694`.

### Premium Health NY Same-Address Group

- `BPS-LAL-040192`, `BPS-LAL-041175`, `BPS-LAL-040190` and `BPS-LAL-041408` all use 4510 16th Ave, Brooklyn, NY 11204-1101.
- Existing production `BPS-LAL-040196` - Premium Rx uses the same address, same coordinate and Premium Health domain.
- These should remain suspicious/hold until HRSA site history confirms whether the rows are distinct sites, administrative duplicates, or source-ID changes.

### Missing Critical Details or Similar Production Records

- `BPS-H80-000988` (PA) - official addition has missing address and missing website; hold before any future staging.
- `BPS-H80-032725` (NJ) - packet same/similar-address flag plus CompleteCare name/phone/domain similarity; verify exact site before staging.
- `BPS-H80-032492` (NJ) - missing website and same/similar Jewish Renaissance identity as production.
- `BPS-H80-038343` (NJ) - missing website and same name as nearby Rutgers RWJ Eric B. Chandler production record.
- `BPS-H80-036171` (NJ) - same/similar Alliance organization identity and domain; boundary review needed.
- NJ additions with missing websites that are not already holds still need manual source checks before staging: `BPS-H80-039294`, `BPS-H80-041425`, `BPS-H80-017286`, `BPS-H80-035726`, `BPS-H80-018011`, `BPS-H80-034397`, `BPS-H80-041422`, `BPS-H80-028090`.

## Dist Safety

This worksheet is under `docs/reports`, and the optional structured review-decision file is also under `docs/reports`. These are documentation/review artifacts only and must not be copied into production `dist`.
