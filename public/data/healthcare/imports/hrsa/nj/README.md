# New Jersey HRSA service-delivery refresh

The 2026-07-13 intake compares production New Jersey HRSA records with the
official `Health Center Service Delivery and Look-Alike Sites` CSV:

https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv

The official file contained 168 active New Jersey rows. Production already had
138 stable source IDs. Of the 30 additions, 14 were administrative-only
locations and were excluded because they should not appear as patient-facing
healthcare-center markers.

`hrsa-nj-service-delivery-additions-2026-07-13.csv` contains the remaining 16
official rows whose HRSA type includes `Service Delivery Site`. All 16 have
stable source IDs, source-provided coordinates inside New Jersey, addresses and
contact information.

Fifteen rows passed source, coordinate and duplicate review and were promoted.
`BPS-H80-019637` remains in staging as `needs_more_source_info` because its name
and address exactly duplicate production source ID `BPS-H80-017493`. Do not
promote it unless a later official-source review confirms that it is a distinct
patient-facing site.
