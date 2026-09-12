# HRSA Refresh Human-Review Packet - 2026-06-24

> Review-only packet. This file does not stage, promote, remove, regenerate, or update production healthcare records.

## Executive Summary

- Audit report: `docs/reports/hrsa-refresh-audit-2026-06-24.md`
- Official CSV: `public/data/healthcare/imports/hrsa/refresh/hrsa-official-2026-06-24.csv`
- Production comparison file: `public/data/healthcare/facilities.json`
- Total production records in scope: 1967
- Total upstream records in scope: 2008
- Matched records: 1965
- Upstream additions: 43
- Production records missing upstream: 2
- Changed records: 65
- Duplicate source IDs: 0 upstream, 0 production
- Invalid coordinates: 0
- Out-of-bounds coordinates: 0
- Recommended decision: do not refresh automatically.

Highest-risk review items:
- Suspicious/hold additions to review before staging:
- BPS-LAL-040192 (NY) - coordinate near border/boundary (2.2 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address
- BPS-LAL-041175 (NY) - coordinate near border/boundary (2.2 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address
- BPS-H80-004971 (NJ) - coordinate near border/boundary (4.5 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address
- BPS-H80-008251 (NJ) - missing website; same/similar address as existing production record; likely duplicate by name/address
- BPS-H80-007901 (NJ) - coordinate near border/boundary (0.5 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address
- BPS-LAL-040190 (NY) - coordinate near border/boundary (2.2 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address
- BPS-H80-037717 (NJ) - missing website; coordinate near border/boundary (2.3 mi); same/similar address as existing production record; likely duplicate by name/address
- BPS-H80-019637 (NJ) - missing website; coordinate near border/boundary (2.4 mi); same/similar address as existing production record; likely duplicate by name/address
- Production records missing upstream: BPS-H80-003698 (NY), BPS-H80-010657 (CT)
- NJ additions are the largest review queue and should be reviewed first.

## State-by-State Summary

| State | Production count | Upstream count | Matched count | Additions | Missing upstream | Changed records | Review priority |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| CT | 462 | 467 | 461 | 6 | 1 | 5 | high |
| DE | 16 | 16 | 16 | 0 | 0 | 0 | low |
| NJ | 138 | 168 | 138 | 30 | 0 | 56 | high |
| NY | 871 | 874 | 870 | 4 | 1 | 4 | high |
| PA | 480 | 483 | 480 | 3 | 0 | 0 | medium |

Additions by state:
- CT: 6
- DE: 0
- NJ: 30
- NY: 4
- PA: 3

## Additions Review Table

| State | Source ID | Facility/site name | Address | City | Postal code | Latitude/longitude | Phone | Website | Why it appears new | Review risk flags | Recommended review action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CT | BPS-H80-030588 | Bristol Eastern High School | 632 King St | Bristol | 06010-4400 | 41.68553, -72.92242996 | 860-793-3500 | www.wheelerclinic.org | Source ID was present in the official HRSA CSV but not in production. | none | likely safe to stage later |
| PA | BPS-H80-018318 | Honesdale Behavioral Health | 600 Maple Ave, Suite 15 | Honesdale | 18431-1460 | 41.57505468, -75.26865014 | 570-251-6676 | http://www.wmh.org/community_health_centers | Source ID was present in the official HRSA CSV but not in production. | none | likely safe to stage later |
| NJ | BPS-H80-008812 | North Hudson Community Action Corporation- Corporate Headquarters | 800 31st St | Union City | 07087-2428 | 40.77374897, -74.03355131 | 201-210-0100 | nhcac.org | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (1.4 mi) | needs manual source confirmation |
| NJ | BPS-LAL-039367 | Star Community Health | 388 Memorial Pkwy | Phillipsburg | 08865-1535 | 40.69537716, -75.1900066 | 908-847-5630 | Starcommunityhealth.org | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (0.6 mi) | needs manual source confirmation |
| NY | BPS-LAL-040192 | Premium Health, Inc. | 4510 16th Ave | Brooklyn | 11204-1101 | 40.63320306, -73.98361168 | 718-407-7300 | premiumhealth.org | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (2.2 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address | suspicious/hold |
| CT | BPS-H80-040356 | Bristol Eastern High School | 632 King St | Bristol | 06010-4400 | 41.68553, -72.92242996 | 860-584-7876 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website | needs manual source confirmation |
| NY | BPS-LAL-041175 | Premium Health, Inc. | 4510 16th Ave | Brooklyn | 11204-1101 | 40.63320306, -73.98361168 | 718-434-5600 | premiumhealth.org | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (2.2 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address | suspicious/hold |
| NJ | BPS-H80-003788 | METROPOLITAN FAMILY HEALTH NETWORK | 935 Garfield Ave | Jersey City | 07304-2731 | 40.71103649, -74.07064358 | 201-478-5802 | www.metrofhn.com | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (1.1 mi) | needs manual source confirmation |
| PA | BPS-H80-013882 | Public Health Management Corporation | 1500 Market St | Philadelphia | 19102-2100 | 39.95217975, -75.16615388 | 215-985-2500 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (1.7 mi) | needs manual source confirmation |
| NJ | BPS-H80-004971 | NEWARK COMMUNITY HEALTH CENTERS, INC. | 741 Broadway | Newark | 07104-4390 | 40.77519044, -74.15875968 | 973-483-1300 | www.nchcfqhc.org | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (4.5 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address | suspicious/hold |
| NJ | BPS-H80-008251 | CHEMED | 1771 Madison Ave | Lakewood | 08701-1242 | 40.10883698, -74.21761296 | 732-364-2144 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; same/similar address as existing production record; likely duplicate by name/address | suspicious/hold |
| NJ | BPS-H80-005615 | Kids' Center at Downe Twp. Elementary School | 220 County Highway 553 | Newport | 08345-2129 | 39.2971, -75.1653 | 856-451-4700 | www.completecarenj.org | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (3.2 mi) | needs manual source confirmation |
| NJ | BPS-H80-034033 | AtlantiCare Health Services - FQHC Administration | 1401 Atlantic Ave STE 1125 | Atlantic City | 08401-7001 | 39.36182953, -74.42891169 | 609-572-6002 | www.atlanticare.org | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (0.5 mi) | needs manual source confirmation |
| NJ | BPS-H80-039294 | VNACJ Community Health Center, Inc. Administration | 3600 State Route 66 | Neptune | 07753-2645 | 40.22146394, -74.08748257 | 732-502-5117 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (4.5 mi) | needs manual source confirmation |
| NJ | BPS-H80-007901 | Central Jersey Medical Center | 275 Hobart St | Perth Amboy | 08861-3396 | 40.50851399, -74.26954497 | 732-376-9333 | www.jrmc.us | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (0.5 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address | suspicious/hold |
| NJ | BPS-H80-041425 | KIPP: Cooper Norcross | 525 Clinton St | Camden | 08103-1223 | 39.93887776, -75.11974538 | 856-968-2320 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (0.9 mi) | needs manual source confirmation |
| NJ | BPS-H80-001408 | Henry J. Austin Health Center-Warren | 321 N Warren St | Trenton | 08618-4794 | 40.2253842, -74.76541786 | 609-278-5900 | www.henryjaustin.org | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (0.7 mi) | needs manual source confirmation |
| NY | BPS-LAL-040190 | Premium Health, Inc. | 4510 16th Ave | Brooklyn | 11204-1101 | 40.63320306, -73.98361168 | 718-407-7300 | premiumhealth.org | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (2.2 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address | suspicious/hold |
| NJ | BPS-H80-032725 | CompleteCare Health Network | 14 N Pearl St | Bridgeton | 08302-1902 | 39.42941499, -75.23302303 | 856-451-4700 | www.completecarenj.org | Source ID was present in the official HRSA CSV but not in production. | same/similar address as existing production record | needs manual source confirmation |
| NJ | BPS-H80-017286 | Project H.O.P.E. West Street Health Center | 519-525 West St | Camden | 08103 | 39.93903701, -75.122485 | 856-968-2320 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (0.7 mi) | needs manual source confirmation |
| CT | BPS-H80-039839 | CREC Head Start at the Swift Factory SBHC | 10 Love Ln | Hartford | 06112-1614 | 41.79173052, -72.68122352 | 860-347-6971 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website | needs manual source confirmation |
| NJ | BPS-H80-032492 | Jewish Renaissance Foundation, Inc. | 1090 King Georges Post Rd, Suite 704 | Edison | 08837-3722 | 40.5234088, -74.32688523 | 732-324-2114 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (3.6 mi); same/similar name as existing production record | needs manual source confirmation |
| NJ | BPS-H80-037717 | Saint James Health 255 Admin | 255 Lafayette St | Newark | 07105-2125 | 40.72858069, -74.16095951 | 973-679-6846 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (2.3 mi); same/similar address as existing production record; likely duplicate by name/address | suspicious/hold |
| NJ | BPS-H80-008888 | CAMcare Riverview | 130 Mickle Blvd | Camden | 08103-1025 | 39.94240737, -75.12664595 | 856-541-6359 | www.camcare.net | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (0.5 mi) | needs manual source confirmation |
| NJ | BPS-H80-035341 | Southern Jersey Family Medical Centers, Inc. | 1 Executive Drive | Marlton | 08053 | 39.87051089, -74.9235806 | 609-481-3116 | www.sjfmc.org | Source ID was present in the official HRSA CSV but not in production. | none | likely safe to stage later |
| NJ | BPS-H80-038343 | Rutgers RWJ Eric B. Chandler Health Center | 277 George St | New Brunswick | 08901-1476 | 40.49173074, -74.44251627 | 732-235-6700 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; same/similar name as existing production record | needs manual source confirmation |
| NJ | BPS-H80-019637 | Saint James Health, Inc. | 228 Lafayette St | Newark | 07105-1815 | 40.72890972, -74.16278031 | 973-789-8111 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (2.4 mi); same/similar address as existing production record; likely duplicate by name/address | suspicious/hold |
| NJ | BPS-H80-000725 | Mary Eliza Mahoney Health Center | 394 University Ave | Newark | 07102-1246 | 40.73413198, -74.17751201 | 800-734-7083 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (3.2 mi); same/similar address as existing production record; likely duplicate by name/address | suspicious/hold |
| NJ | BPS-H80-035726 | One Port Center | 2 Riverside Dr | Camden | 08103-1054 | 39.94438701, -75.13007147 | 856-583-2400 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (0.3 mi) | needs manual source confirmation |
| NJ | BPS-H80-018011 | Lakewood | 212 2nd St | Lakewood | 08701-3424 | 40.09231449, -74.21273427 | 845-354-9300 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website | needs manual source confirmation |
| NJ | BPS-H80-034397 | Henry J. Austin Health Center-Nottingham | 1931 Nottingham Way | Trenton | 08619-3554 | 40.23292762, -74.71025152 | 609-278-5900 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (3.5 mi) | needs manual source confirmation |
| NY | BPS-LAL-041408 | Premium Health, Inc. | 4510 16th Ave | Brooklyn | 11204-1101 | 40.63320306, -73.98361168 | 718-434-5600 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (2.2 mi); same/similar address as existing production record; same/similar name as existing production record; likely duplicate by name/address | suspicious/hold |
| PA | BPS-H80-000988 | BROAD TOP AREA MEDICAL CENTER, INC. | _(missing)_ | Broad Top | 16621-9001 | 40.20104998, -78.13437799 | 814-635-2916 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing address; missing website | needs manual source confirmation |
| NJ | BPS-H80-001082 | CAMCARE - GATEWAY HEALTH CENTER | 817 Federal St | Camden | 08103-1539 | 39.94422671, -75.11558645 | 856-541-3270 | WWW.CAMCARE.NET | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (1.1 mi) | needs manual source confirmation |
| NJ | BPS-H80-032726 | CompleteCare Health Network | 1020 High St N | Millville | 08332-2527 | 39.40957532, -75.04113117 | 856-451-4700 | www.completecarenj.org | Source ID was present in the official HRSA CSV but not in production. | none | likely safe to stage later |
| CT | BPS-H80-037509 | Pulaski Middle School | 757 Farmington Ave | New Britain | 06053-1364 | 41.6995637, -72.78777486 | 860-793-3500 | www.wheelerclinic.org | Source ID was present in the official HRSA CSV but not in production. | none | likely safe to stage later |
| NJ | BPS-H80-041422 | CAMcare Mobile Unit | 1420 Crestmont Ave | Camden | 08103-3182 | 39.92762698, -75.09866799 | 856-583-2400 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website; coordinate near border/boundary (1.8 mi) | needs manual source confirmation |
| CT | BPS-H80-013867 | Pulaski Middle School | 757 Farmington Ave | New Britain | 06053-1364 | 41.6995637, -72.78777486 | 860-347-6971 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website | needs manual source confirmation |
| NJ | BPS-H80-003137 | Colt Connection at Cumberland Regional High School | 65 Love Ln | Bridgeton | 08302-6076 | 39.4716, -75.21829999 | 856-451-9400 x279 | www.completecarenj.org | Source ID was present in the official HRSA CSV but not in production. | none | likely safe to stage later |
| NJ | BPS-H80-028090 | CompleteCare Health Network | 905 W Main St | Millville | 08332-4519 | 39.39797318, -75.05968552 | 856-451-4700 | _(missing)_ | Source ID was present in the official HRSA CSV but not in production. | missing website | needs manual source confirmation |
| NJ | BPS-H80-004219 | Zufall Health Center | 18 W Blackwell St | Dover | 07801-3841 | 40.88386014, -74.55970776 | 973-328-9100 | WWW.zufallhealth.org | Source ID was present in the official HRSA CSV but not in production. | same/similar address as existing production record; likely duplicate by name/address | suspicious/hold |
| CT | BPS-H80-004638 | Macdonough Elementary School - SBHC (Rita Hayes Wellness Center) | 66 Spring St | Middletown | 06457-2262 | 41.56692167, -72.65651115 | 860-344-9821 | www.chc1.com | Source ID was present in the official HRSA CSV but not in production. | none | likely safe to stage later |
| NJ | BPS-H80-036171 | Alliance Community Healthcare Inc. Administrative Offices | 26 Journal Sq, Suite 1600 | Jersey City | 07306-3847 | 40.7304442, -74.06372298 | 201-451-6300 | www.alliancech.org | Source ID was present in the official HRSA CSV but not in production. | coordinate near border/boundary (2.0 mi) | needs manual source confirmation |

## Missing-Upstream Review Table

| State | Source ID | Facility/site name | Production address | Production phone/website | Last source metadata available | Recommended action |
| --- | --- | --- | --- | --- | --- | --- |
| NY | BPS-H80-003698 | BROOKLYN PLAZA MEDICAL CENTER, INC. | 650 Fulton St, Brooklyn, NY 11217-1517 | phone=718-596-9800; website=www.brooklynplaza.org | sourceName=HRSA Health Center Service Delivery and Look-Alike Sites; sourceUrl=https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv; sourceLastUpdated=2026-06-19; lastChecked=2026-06-19; lastVerified=2026-06-19 | do not remove automatically; verify against HRSA source/history; check if source ID changed, site closed, merged, or data issue |
| CT | BPS-H80-010657 | OPTIMUS at Inspirica | 8 Woodland Pl, Stamford, CT 06902-6939 | phone=203-388-0170; website= | sourceName=HRSA Health Center Service Delivery and Look-Alike Sites; sourceUrl=https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv; sourceLastUpdated=2026-06-19; lastChecked=2026-06-19; lastVerified=2026-06-19 | do not remove automatically; verify against HRSA source/history; check if source ID changed, site closed, merged, or data issue |

## Changed-Records Review Table

Changed-record counts by category:
- Coordinate changes: 63
- Address/postal changes: 23
- Phone/website changes: 0
- Identity/name changes: 0
- Status/type changes: 0

### Coordinate Changes

| State | Source ID | Facility/site name | Changed fields | Production value | Upstream value | Approx. distance moved | Same state | May affect boundary assignment | Review risk level |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| NJ | BPS-H80-000131 | CAMCARE - NORTH HEALTH CENTER | latitude, longitude | 39.95453398, -75.11650301 | 39.95428348, -75.11658498 | 0.018 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-000158 | BROADWAY CLINIC | latitude, longitude | 40.91875287, -74.16512179 | 40.9188693, -74.16504837 | 0.009 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-000865 | BUTTONWOOD | latitude, longitude | 39.96759918, -74.63748344 | 39.96768799, -74.63813103 | 0.035 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-000945 | PLEASANTVILLE | latitude, longitude | 39.38291844, -74.53037278 | 39.3827355, -74.53017178 | 0.017 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-001091 | North Hudson Community Action Corporation Health Center @ Union City | latitude, longitude | 40.77275998, -74.03187686 | 40.77282193, -74.03184869 | 0.005 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-001281 | Shabazz High School | latitude, longitude | 40.71847564, -74.19219174 | 40.7188296, -74.1916133 | 0.039 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-001403 | Kids' Corner at Broad St. School | latitude, longitude | 39.42961276, -75.24549413 | 39.43068372, -75.24520059 | 0.076 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-001532 | Metropolitan Family Health Network, Inc. at West New York | latitude, longitude | 40.7848562, -74.01933611 | 40.78462956, -74.01902598 | 0.023 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-001647 | CAMCARE - EAST HEALTH CENTER | latitude, longitude | 39.94616054, -75.08829279 | 39.94594098, -75.08822398 | 0.016 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-001742 | NEWARK COMMUNITY HEALTH CENTERS, INC. | latitude, longitude | 40.68924312, -74.20536733 | 40.68927958, -74.20586639 | 0.026 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-001959 | CAMCARE - GENERATIONS HEALTH CENTER | latitude, longitude | 39.81146051, -74.98322807 | 39.81167295, -74.98312321 | 0.016 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-002609 | Women and Children's Health Pavilion | latitude, longitude | 39.3632977, -74.42529875 | 39.36362476, -74.42542942 | 0.024 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-003004 | North Hudson Community Action Corporation Health Center @ Garfield | latitude, longitude | 40.88219897, -74.10088607 | 40.88238078, -74.10267527 | 0.094 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-003005 | Henry J. Austin Health Center-Chambers | latitude, longitude | 40.21917224, -74.74457508 | 40.21906713, -74.74471556 | 0.010 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-003026 | ATLANTIC CITY | latitude, longitude | 39.36252996, -74.42718996 | 39.36284093, -74.42731426 | 0.022 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-003728 | CompleteCare Women's Medical Professionals | latitude, longitude | 39.47689391, -74.9771625 | 39.47714953, -74.97678418 | 0.027 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-004594 | CompleteCare Dental Professionals | latitude, longitude | 39.71021265, -75.11019898 | 39.71012833, -75.11038229 | 0.011 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-004754 | EAST ORANGE PRIMARY CARE CENTER | latitude, longitude | 40.76569894, -74.21327767 | 40.76576198, -74.2132485 | 0.005 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-004921 | Neighborhood Health Center The Healthy Place | latitude, longitude | 40.60634878, -74.43014299 | 40.60667928, -74.4300668 | 0.023 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-004925 | Teen Center at Bridgeton High School | latitude, longitude | 39.46539629, -75.209465 | 39.46541482, -75.20933684 | 0.007 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-005237 | SALEM HEALTH CENTER | latitude, longitude | 39.57029714, -75.46463161 | 39.57055623, -75.46438644 | 0.022 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-005574 | Henry J. Austin Health Center-Ewing | latitude, longitude | 40.22459236, -74.75655475 | 40.22462287, -74.75642483 | 0.007 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-006048 | Neighborhood Health Center Cardinal | latitude, longitude | 40.61199252, -74.41233396 | 40.61123769, -74.41176709 | 0.060 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-006415 | Mary Eliza Mahoney Health Center Mobile Medical Unit | latitude, longitude | 40.73418512, -74.1776395 | 40.73413198, -74.17751201 | 0.008 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-007624 | Irvington Community Health Center | latitude, longitude | 40.72535056, -74.23614677 | 40.72562435, -74.236143 | 0.019 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-008827 | CompleteCare Pediatric & Family Medical Professionals | latitude, longitude | 39.43471118, -75.22204743 | 39.43493054, -75.22215991 | 0.016 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-010983 | Monmouth Family Health Center OB/GYN Womens Health Services | latitude, longitude | 40.29690719, -73.98294632 | 40.29672844, -73.98292931 | 0.012 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-012509 | Zufall Healthy Smile Center - Flemington | latitude, longitude | 40.54661678, -74.85657667 | 40.54672629, -74.85697263 | 0.022 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-012510 | CompleteCare Medical & Dental Professionals | latitude, longitude | 38.98967659, -74.81706605 | 38.98990885, -74.81724073 | 0.019 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-012729 | VOA Liberty Street Facility | latitude, longitude | 39.93013447, -75.11887509 | 39.93005203, -75.11897835 | 0.008 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-012868 | OHI-Clifton Avenue School Based Health Center | latitude, longitude | 40.09648679, -74.21539318 | 40.09658737, -74.21488993 | 0.027 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-014317 | North Hudson Community Action Corporation Health Center @ Englewood | latitude, longitude | 40.88892361, -73.9807967 | 40.88860711, -73.9804864 | 0.027 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-014865 | CompleteCare Vineland Health Campus | latitude, longitude | 39.44676549, -75.0441246 | 39.446278, -75.04415302 | 0.034 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-015353 | Thirteenth Avenue School | latitude, longitude | 40.74398038, -74.19736982 | 40.7424646, -74.19813853 | 0.112 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-015619 | Henry J. Austin Health Center at Oaks Integrated Care Inc. | latitude, longitude | 40.22078304, -74.75908483 | 40.22081899, -74.75906102 | 0.003 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-015621 | Henry J. Austin Health Center at Catholic Charities, Diocese of Trenton | latitude, longitude | 40.22314552, -74.75586542 | 40.22307394, -74.75573726 | 0.008 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-017136 | Zufall Health Center Hackettstown | latitude, longitude | 40.85617492, -74.81549679 | 40.85771082, -74.81513243 | 0.108 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-017739 | Zufall Health Center - Sussex | latitude, longitude | 41.05590164, -74.74950859 | 41.05561179, -74.74978376 | 0.025 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-018268 | North Hudson Community Action Corporation Health Center @ Union City High School | latitude, longitude | 40.77094321, -74.03648766 | 40.77082108, -74.03638917 | 0.010 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-018269 | North Hudson Community Action Coporation-Harrison Health  Center | latitude, longitude | 40.74648054, -74.15678515 | 40.74659076, -74.15680133 | 0.008 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-018784 | Newark Community Health Centers, Inc. dba Ironbound Medical and Dental Center | latitude, longitude | 40.73090914, -74.16113989 | 40.73115444, -74.16100175 | 0.018 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-019176 | Cathedral Kitchen Satellite Site | latitude, longitude | 39.94425194, -75.10229493 | 39.94405698, -75.10227003 | 0.014 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-027550 | Saint James Health, Inc. West | latitude, longitude | 40.73855687, -74.19935491 | 40.73848295, -74.19927503 | 0.007 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-032325 | Zufall Health Plainsboro | latitude, longitude | 40.33827209, -74.62482451 | 40.34013304, -74.62379529 | 0.140 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-036679 | CompleteCare Mobile Medical Unit | latitude, longitude | 39.44676549, -75.0441246 | 39.446278, -75.04415302 | 0.034 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-036822 | AtlantiCare Health Services-FQHC Substance Use Disorder Clinic | latitude, longitude | 39.36193388, -74.42868957 | 39.36257573, -74.42916264 | 0.051 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-037103 | Zufall Health Center West Orange | latitude, longitude | 40.77947624, -74.24096679 | 40.77965569, -74.24092161 | 0.013 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-037577 | 394 University Avenue Mobile #2 | latitude, longitude | 40.73418512, -74.1776395 | 40.73413198, -74.17751201 | 0.008 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-037651 | Mary Eliza Mahoney Health Center @ Speedway | latitude, longitude | 40.74511416, -74.21618628 | 40.74531013, -74.21618753 | 0.014 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-037818 | Mary Eliza Mahoney Health Center Mobile Unit #3 | latitude, longitude | 40.73418512, -74.1776395 | 40.73413198, -74.17751201 | 0.008 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-038344 | Rutgers RWJ Eric B. Chandler Health Center | latitude, longitude | 40.48174919, -74.48232067 | 40.48061613, -74.48158675 | 0.087 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-038364 | Central Jersey Medical Center | latitude, longitude | 40.59539036, -74.25131223 | 40.59568708, -74.25123613 | 0.021 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-038486 | Men & Family Health Professionals | latitude, longitude | 39.69243073, -75.00204376 | 39.69270273, -75.0023264 | 0.024 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-H80-039842 | Mary Eliza Mahoney Health Center Mobile Dental Unit | latitude, longitude | 40.73418512, -74.1776395 | 40.73413198, -74.17751201 | 0.008 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NJ | BPS-LAL-037089 | Star Community Health-Coventry | latitude, longitude | 40.7001903, -75.17416438 | 40.69917551, -75.17486645 | 0.079 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NY | BPS-H80-036254 | Sun River Health Copiague | latitude, longitude | 40.67974818, -73.40129178 | 40.6800659, -73.40132414 | 0.022 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NY | BPS-H80-037536 | Tremont Health Center | latitude, longitude | 40.84631546, -73.89729702 | 40.84627569, -73.89722561 | 0.005 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| NY | BPS-H80-036435 | Sun River Health White Plains | latitude, longitude | 41.02408368, -73.76304399 | 41.0239629, -73.76332102 | 0.017 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| CT | BPS-LAL-030726 | InterCommunity Administrative Office | latitude, longitude | 41.76982404, -72.66057068 | 41.77022914, -72.66173937 | 0.066 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| CT | BPS-H80-040161 | CS-HHC at 266 State Street | latitude, longitude | 41.30387371, -72.9237652 | 41.30387178, -72.9237616 | 0.000 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| CT | BPS-H80-035581 | Anchor Alternative High School SBHC | latitude, longitude | 41.05914556, -73.53543474 | 41.05914992, -73.5354422 | 0.000 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| CT | BPS-H80-035574 | Newfield School SBHC | latitude, longitude | 41.0907784, -73.54042811 | 41.09110127, -73.53968212 | 0.045 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |
| CT | BPS-H80-033691 | Schaghticoke Middle School | latitude, longitude | 41.62069364, -73.3919302 | 41.62024001, -73.39256002 | 0.045 mi | yes | unlikely, but regenerate assignments after any coordinate promotion | low |

### Address/Postal Changes

| State | Source ID | Facility/site name | Changed fields | Production value | Upstream value | Review risk level |
| --- | --- | --- | --- | --- | --- | --- |
| NJ | BPS-H80-000131 | CAMCARE - NORTH HEALTH CENTER | address | address: N 6th St & Erie St | address: 6th St & Erie St | medium |
| NJ | BPS-H80-000865 | BUTTONWOOD | postal code | postal code: 08068-1537 | postal code: 08068 | low |
| NJ | BPS-H80-001281 | Shabazz High School | postal code | postal code: 07108-2729 | postal code: 07108-2895 | low |
| NJ | BPS-H80-004594 | CompleteCare Dental Professionals | postal code | postal code: 08028-1403 | postal code: 08028-1494 | low |
| NJ | BPS-H80-004921 | Neighborhood Health Center The Healthy Place | postal code | postal code: 07060-2012 | postal code: 07060-2097 | low |
| NJ | BPS-H80-006048 | Neighborhood Health Center Cardinal | postal code | postal code: 07060-3002 | postal code: 07060-3089 | low |
| NJ | BPS-H80-006415 | Mary Eliza Mahoney Health Center Mobile Medical Unit | postal code | postal code: 07102-1221 | postal code: 07102-1246 | low |
| NJ | BPS-H80-010983 | Monmouth Family Health Center OB/GYN Womens Health Services | postal code | postal code: 07740-6413 | postal code: 07740-6490 | low |
| NJ | BPS-H80-012509 | Zufall Healthy Smile Center - Flemington | address | address: 361 State Route 31 BLDG C | address: 361 State Route 31 | medium |
| NJ | BPS-H80-012649 | RiteCare at Vineland ShopRite | address | address: 1255 W Landis Ave | address: 1255 Landis Ave | medium |
| NJ | BPS-H80-015353 | Thirteenth Avenue School | postal code | postal code: 07103-2125 | postal code: 07103-2197 | low |
| NJ | BPS-H80-015619 | Henry J. Austin Health Center at Oaks Integrated Care Inc. | address | address: 314 E State St | address: 316 E State St | medium |
| NJ | BPS-H80-017136 | Zufall Health Center Hackettstown | address | address: 117 Seber Rd | address: 117 Seber Rd, Building 5 | medium |
| NJ | BPS-H80-036822 | AtlantiCare Health Services-FQHC Substance Use Disorder Clinic | address | address: 1401 Atlantic Ave STE 2300 | address: 1401 Atlantic Ave, Suite 2300 | medium |
| NJ | BPS-H80-037577 | 394 University Avenue Mobile #2 | postal code | postal code: 07102-1221 | postal code: 07102-1246 | low |
| NJ | BPS-H80-037818 | Mary Eliza Mahoney Health Center Mobile Unit #3 | postal code | postal code: 07102-1221 | postal code: 07102-1246 | low |
| NJ | BPS-H80-038344 | Rutgers RWJ Eric B. Chandler Health Center | postal code | postal code: 08901-3638 | postal code: 08901-3391 | low |
| NJ | BPS-H80-039842 | Mary Eliza Mahoney Health Center Mobile Dental Unit | postal code | postal code: 07102-1221 | postal code: 07102-1246 | low |
| NJ | BPS-LAL-037089 | Star Community Health-Coventry | address | address: 755 Memorial Pkwy, Ste 300 | address: 755 Memorial Pkwy, Suite 300 | medium |
| NY | BPS-H80-028389 | 770 East 176 Street | address | address: 770 E 176th St FL 2 | address: 770 E 176th St | medium |
| NY | BPS-H80-036254 | Sun River Health Copiague | address | address: 445 Oak St STE 201 | address: 445 Oak St | medium |
| NY | BPS-H80-036435 | Sun River Health White Plains | address | address: 360 Mamaroneck Ave # 1 | address: 360 Mamaroneck Ave, Suite 1 | medium |
| CT | BPS-LAL-030726 | InterCommunity Administrative Office | address | address: 800 Connecticut Blvd BLDG | address: 800 Connecticut Blvd | medium |

### Phone/Website Changes

| State | Source ID | Facility/site name | Changed fields | Production value | Upstream value | Review risk level |
| --- | --- | --- | --- | --- | --- | --- |
| _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ |

### Identity/Name Changes

| State | Source ID | Facility/site name | Changed fields | Production value | Upstream value | Review risk level |
| --- | --- | --- | --- | --- | --- | --- |
| _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ |

### Status/Type Changes

| State | Source ID | Facility/site name | Changed fields | Production value | Upstream value | Review risk level |
| --- | --- | --- | --- | --- | --- | --- |
| _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ |

## Recommended Refresh Approach

Do not run a full automatic refresh.

1. Manually review additions, starting with NJ because it has the largest queue.
2. Manually review the 2 missing-upstream production records.
3. Review coordinate changes that may alter boundary assignments.
4. Only then run a state-by-state staging workflow.
5. Promote only reviewed and approved records.
6. Regenerate facility-boundary assignments and summaries after promotion.
7. Re-run this packet generator after each future read-only audit so reviewers have a stable queue.

## Production-Dist Safety

- This review packet is under `docs/reports` and is not a runtime app asset.
- HRSA audit reports, review packets, official CSVs, staging files and fixtures must not be copied into `dist`.
- `npm run validate:production-dist` is the production artifact check after a build.
