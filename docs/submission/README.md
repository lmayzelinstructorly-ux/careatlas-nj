# CareAtlas submission package

Prepared September 14, 2026. This package documents completed engineering work and remaining evidence gaps; it is not a claim that all submission requirements or outside validation are complete.

## Ready to review

- [Narrated walkthrough](assets/careatlas-walkthrough.mp4): 3 minutes 17 seconds, 1280×720, English synthetic narration. It uses actual application screenshots, not a continuous screen recording. No actors, resident testimonials or expert endorsements are depicted.
- [Interactive walkthrough](walkthrough.html), with [editable narration](walkthrough.json). Run `npm run dev` and open `http://localhost:5173/docs/submission/walkthrough.html`. Use the arrow buttons or arrow keys. The HTML preview is a repository document, not a production app route.
- [Contribution and source inventory](contribution.md): pipeline, source versions, attribution, development chronology and AI assistance.
- [Technical methods review](methods-review.md), including [reproducible sensitivity results](sensitivity.json). Re-run with `node scripts/reviewScreeningSensitivity.mjs`.
- [Browser review](browser-review.md): five agent-operated scenarios, observed fixes and explicit testing limits.
- Submission screenshots: [town search](assets/search.png), [Newark summary](assets/newark.png), [tract explanation](assets/tract.png), [source evidence](assets/sources.png), [export controls](assets/export.png), [mobile missing evidence](assets/mobile-missing.png).

## Validation and fixes

`npm run check:changed` selected and passed the complete `npm run check` suite after the changes. This included 24 UI tests across five files, source/data/importer checks, the production build, local HTTP checks and the Cloudflare packaging dry run. Hosted GitHub Actions was not run in this review. The finished MP4 was decoded successfully through its entire 3:17 duration.

Two changes resulted from this review: SVI values are correctly labeled as New Jersey percentiles, and loaded results can be printed even when they are not flagged. The SVI source comparison checked all 10,905 published observations against the pinned state file, finding zero numeric/missing-value mismatches. The sensitivity analysis reproduced all 2,181 current classifications.

The fixes were deployed to the [live site](https://careatlas.lmayzel930.workers.dev) on September 14, Cloudflare version `69594279-2558-48a6-913f-8e07ed733abb`. A live browser check confirmed Print brief on tract 19 and the corrected New Jersey percentile wording. All 47 changed data files were compared with the prior Git revision and contained only the intended SVI text corrections.

## Still required

| Item | Actual status |
| --- | --- |
| Five resident sessions | **0 completed.** Agent scenarios do not count as residents. |
| Independent public-health/GIS methods review | **0 completed.** The AI desk review is not external expert validation. |
| Native download / print preview / clipboard round trip | Browser bridge did not expose completion; end-to-end verification remains open. |
| Source chronology | Imported June/July metadata needs reconciliation with the author-reported August 1 implementation start. |
| Dataset reuse notices | Source and general publisher policies documented; dataset-specific HRSA grant not verified. |
| Public repository access | Repository remains private as requested. Do not submit a private URL as unrestricted judge access. |
| Hosted demo video and Devpost submission | Video is prepared locally and in the repository; no upload or submission was made. |

Use the [resident and expert kit](../outside-review-kit.md) for the remaining human work. Real sessions should record task outcomes and misunderstandings, including unsuccessful attempts. The author's own feedback can improve the app but cannot stand in for five outside residents. A public quote requires permission for the exact attribution; anonymous aggregate observations can be reported without inventing testimonials.

Before submitting, compare the entry against the organizer's [current rules](https://gibc-v2.devpost.com/rules), including repository access, video hosting, screenshots, participant eligibility and disclosure requirements. No competition form was submitted and repository visibility was not changed.
