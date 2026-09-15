# Browser and task review — September 14, 2026

Operator: OpenAI Codex. **Five agent-operated scenarios, zero resident participants.** No participant success rate, completion time, quote, consent or satisfaction rating was collected. This is not a substitute for five resident sessions.

Environment: Codex in-app Chromium browser, live site initially; corrected local app at `localhost:5173`. Desktop 1280×720 and mobile viewport 390×844. A resized viewport is not a physical phone test. Screenshots in `assets/` show actual application output.

| Scenario | Observed result |
| --- | --- |
| Find a town | Searching Newark showed Newark City and East Newark Borough. The first result is preselected: Enter selects it; Down then Enter moves to the second result. The Newark shared URL displayed 66 of 88 assigned tracts flagged and 18 additional elevated-need tracts. |
| Select and explain a flag | Expanded the town's tract list and opened Census Tract 1 with Enter. The brief explained health need plus shortage evidence and showed diabetes 13.5%, checkup 75.2% and one primary-care HPSA designation. |
| Locate evidence and exports | Expanded full evidence; seven screening inputs exposed source links, thresholds and limitations. Found and corrected the SVI reference-population label. Tab navigation reached source and export links with visible focus. |
| Open nonflagged results directly | Tract 19 displayed elevated need without documented shortage; tract 22.04 displayed no current flag with a warning that this does not establish adequate access. Discovered and fixed print controls being restricted to flagged results. |
| Open missing evidence on mobile | Tract 9801 displayed “Not enough information to determine a gap” rather than reassuring zero. At 390px, document width and scroll width both measured 390px; header, map and scrollable brief fit the viewport. The Newark town summary and tract disclosure were also present on mobile. |

Direct links exercised: `?mode=gaps&town=3401351000`, and `?mode=gaps&tract=` followed by `34013000100`, `34013001900`, `34013002204`, `34013980100`. The `/story` route also loaded directly.

After deployment, a live check of tract 19 confirmed that Print brief is visible and SVI reads “92nd New Jersey percentile.” The full scenario run used the local corrected build; this targeted recheck confirmed both changes reached production.

## Fixes and limits

SVI labels now identify the New Jersey reference population; all stored values match the pinned state file. An importer regression assertion checks that the state file is not described as nationwide. Print is now offered for every loaded result, with a regression assertion for a town with zero flagged tracts. Search preselection is recorded as a possible usability friction, not established resident confusion; no speculative interaction redesign was made.

The live Copy link control reported “Link copied,” but the browser bridge returned no clipboard text. The JSON download click produced no exposed download event, and the print action exposed no print preview. These are **unverified end-to-end**, not passes or confirmed app defects. Existing UI checks cover the clipboard URL and print invocation; data validators cover export records. Native browser download contents and print pagination still need verification in a browser that exposes them. No screen-reader, Safari, Firefox, physical-device, actual-resident or external-expert testing was performed.

Do not publish these five scenarios as five resident sessions. Use the [outside-review kit](../outside-review-kit.md) to collect real sessions and a qualified review when participants become available. Feedback may be reported as anonymous task findings; a name or testimonial needs the participant's specific permission.
