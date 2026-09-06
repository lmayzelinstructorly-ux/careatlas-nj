# CareAtlas NJ: resident and expert review kit

Prepared September 5, 2026. **Status: ready to use; no participant sessions or external expert reviews have been completed for this kit.**

The first audience is New Jersey residents exploring their area. The goal is to discover whether they can find a place, interpret the evidence correctly and identify a useful next question. A separate expert review evaluates the method. Software checks establish consistency with the published rule, not real-world validity.

## 1. Prepare a small resident pilot

Invite five New Jersey residents for individual 20-minute sessions. Aim for a mix of towns, phone and desktop use, and familiarity with maps. Five is a practical first round, not a representative sample or a statistical validation study.

Use the revised build, record its version/commit or ZIP filename, and record the data snapshot date. Start at `/` in a fresh browser session so the welcome appears. Use a town name or the public Newark example; participants do not need to provide a home address or health history. Use participant codes such as R01 in notes. Obtain their permission before recording a session or quoting them publicly.

Draft invitation to send yourself:

> I built CareAtlas NJ, a map that brings public healthcare-access evidence together. Would you spend about 20 minutes trying it while I observe? I am testing the website, not your knowledge. You can use an example town; no personal health information is needed. I want to find what is confusing or unhelpful. Participation is optional, and you can stop at any time.

### Moderator opening

“Please say what you are thinking as you use the map. There are no right clicks to memorize. I will mostly watch so I can learn where the website needs to explain itself better.”

Do not describe the navigation or teach the screening rule before the tasks. If someone becomes stuck, ask “What would you expect to happen?” Mark any navigation help as assisted completion.

### Tasks and observations

| Task to read aloud | Observe | Initial improvement target |
| --- | --- | --- |
| Find information about a New Jersey town you know, or use the example. | First click, route taken, time, help needed. | At least 4 of 5 reach a town summary without help within 90 seconds. |
| Tell me what the result says in your own words. | Whether they confuse the town with a census tract or a flag with proof that care is absent. | At least 4 of 5 understand that it is a screening signal; investigate every serious misinterpretation. |
| Find out why one smaller area was flagged. | Whether they find the tract list, open a brief, and identify both need/barriers and shortage evidence. | At least 4 of 5 find and explain both parts without coaching. |
| Find something that limits what this result can tell you. | Whether limitations and missing-data explanations are discoverable. | At least 4 of 5 identify a relevant limitation. |
| Find the source behind one value. | Whether source disclosures make sense and the linked source supports the value. | Record success and points of confusion; fix broken links. |
| Save a link so you can return to the same place. | Whether Copy link is found and the reopened link restores the same area. | All tested links restore the selected area. |

These are proposed product acceptance targets, not measured results. Report the raw numerator and denominator when sessions occur.

### Closing questions

1. What did you expect the map to tell you that it did not?
2. Did anything suggest more certainty than the evidence supports?
3. When, if ever, would you use this again? What would you do next?
4. What single change would make it more useful?

### Session notes — duplicate per participant

- Participant code / date / build:
- Device / browser / viewport:
- Prior map familiarity (participant's description):
- Town or public example used:

| Task | Completed / assisted / not completed | Time | Observed behavior or exact quote | Proposed fix |
| --- | --- | --- | --- | --- |
| Find town | | | | |
| Explain result | | | | |
| Open tract and explain why | | | | |
| Find limitation | | | | |
| Find source | | | | |
| Reopen shared link | | | | |

## 2. Expert method review

Ask a New Jersey public-health researcher, community health worker with planning experience, or GIS/public-health analyst to review the evidence method. Disclose any existing relationship. Ask for criticism of assumptions and failure cases, not an endorsement.

Draft request to send yourself:

> Could you review the assumptions in a student-built healthcare-access screening map? It combines public CDC, Census and HRSA evidence using a published rule. I would value a short review of what the rule can support, where it could mislead, and how it could be evaluated against independent local evidence. A review would not be represented as a partnership or endorsement.

Provide these repository documents:

- `docs/batch-7-transparent-flagging.md`: exact rule, thresholds and precedence.
- `public/data/tracts/nj/access-gap-rule.v1.json`: machine-readable rule.
- `docs/cdc-places-foundation.md`: modeled estimates and source vintage.
- `docs/batch-6-social-shortage-evidence.md`: SVI, ACS and shortage joins.
- `docs/town-gap-foundation.md`: assignment and overlap definitions.
- The four example tract records below, with sources, missingness and limitations expanded.

### Cases checked in the supplied snapshot

Paths are relative to the revised app's origin. The checked snapshot has 2,181 tracts: 359 potential gaps, 401 elevated-need results without documented shortage, 1,404 no-current-flag results and 17 insufficient-evidence results. Refreshes can change these counts; recheck the records before a later review.

| Example | App path | Question for the reviewer |
| --- | --- | --- |
| Potential gap | `/?mode=gaps&tract=34013000100` | Do the two positive conditions support the wording used? |
| Elevated need without documented shortage | `/?mode=gaps&tract=34013001900` | Could readers mistake no matching designation for no actual shortage? |
| No current flag | `/?mode=gaps&tract=34013002204` | Does the wording prevent an inference of adequate access? |
| Insufficient evidence | `/?mode=gaps&tract=34013980100` | Is missing SVI appropriately explained, including why it overrides other positive evidence? |

These examples illustrate rule states. They are not a representative validation sample.

### Questions that need substantive review

1. Are the selected PLACES indicators appropriate for this screening question? What is lost by using crude modeled estimates, fixed state-relative cutoffs and a two-of-four rule?
2. How should differences in dataset years and geographic vintages affect interpretation?
3. Does intersecting an active HPSA or MUA/P component justify the wording at tract level, especially for partial-area or population-specific designations?
4. Is the SVI threshold of 0.75 suitable for the stated purpose? What cases could change under nearby cutoffs, and should a sensitivity study precede broader use?
5. Is requiring every input appropriate even when one branch of the rule already has enough evidence? What is the cost of the current missing-data precedence?
6. Are town assignment and overlap counts understandable and geographically defensible? Do they invite an incorrect population interpretation?
7. What independent local evidence could challenge the results—such as travel time, appointment availability or a community needs assessment? HRSA designation agreement alone cannot independently validate a rule that already uses HRSA designations.
8. What claims should remain out of scope, and what evidence would be needed before a stronger claim?

### Reviewer response template

- Reviewer role / relevant experience / relationship to project:
- Date / build / evidence snapshot:
- Scope reviewed:
- Supported uses and why:
- Unsupported or misleading uses:
- Specific tract or join examples requiring investigation:
- Missing evidence or alternative explanations:
- Suggested independent evaluation:
- Required changes before wider use:
- Permission to attribute comments publicly (yes/no; exact approved wording):

## 3. Turn feedback into decisions

Keep usability observations separate from methodological findings. For every issue, save the observed behavior or source evidence, its practical effect, and a testable acceptance criterion. Prioritize incorrect interpretation, inaccessible controls and blocked tasks ahead of cosmetic preferences.

| ID | Evidence / participant code | Issue | Severity | Change or reason deferred | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

Run a second small round after fixes. Report dates, participant count, recruitment method, tasks, assisted versus unassisted outcomes, and remaining limitations. Publish only results actually collected. Do not describe participation as an endorsement, validated healthcare access, or demonstrated health impact.

## 4. Completion record

- Resident sessions: **not yet conducted**.
- Expert method review: **not yet conducted**.
- Independent comparison against local access evidence: **not yet conducted**.
- Changes implemented from external findings: **pending findings**.

Replace these statuses only when evidence has been recorded. This kit makes the next step executable; it does not replace outside validation.
