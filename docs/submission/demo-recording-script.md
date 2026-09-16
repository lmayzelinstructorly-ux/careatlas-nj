# CareAtlas NJ: live demo recording script

Target: about 4 minutes, with your own English narration and a real screen recording. Leave the Devpost video URL blank until you have recorded and uploaded the finished video. Nothing in this script authorizes submission.

## Before recording

- Open https://careatlas.lmayzel930.workers.dev in Chrome. Use a desktop window, readable zoom, and hide unrelated tabs and notifications.
- Rehearse once: Potential gaps → search Newark → Newark City → View gap tracts → expand the flagged tract list → Census Tract 1. Choose Newark City, not East Newark Borough.
- Have the repository README and docs/submission/contribution.md open in separate tabs. The repository is public as of September 15, 2026.
- Test Copy link by opening the copied URL in a new tab. Test Print brief and the tract JSON download before recording. Only narrate a successful action if it actually completes. If something fails, fix it before your final take rather than implying success.
- Read the current on-screen values. The September 14 snapshot showed 66 of 88 Newark-assigned tracts flagged; if refreshed data differs, use what the app actually shows.
- Aim for a calm 125–140 words per minute. Pause briefly after each click so the viewer can follow. Do not show API keys, account settings or private messages.

## 0:00–0:25 — Start with the resident's question

**Show:** CareAtlas homepage, then select Potential gaps. Keep the map visible while introducing it.

**Say:**

“If you live in New Jersey, how do you make sense of healthcare-access data around your town? The evidence is spread across agencies, maps and spreadsheets. I built CareAtlas NJ to bring it together: start with a town, understand a tract's screening result, and see the official evidence behind it.”

## 0:25–0:55 — Find Newark

**Show:** Type Newark, choose Newark City, and pause on the town summary. Click View gap tracts.

**Say:**

“I'll start with Newark. CareAtlas connects 564 municipalities with 2,181 census tracts across New Jersey. This summary shows how the tracts assigned to Newark are classified. These are counts of geographic areas—not the percentage of residents without care, and not a label for the entire city. Let's open one of the flagged tracts.”

## 0:55–1:35 — Explain one flag

**Show:** Expand the flagged tract list and select Census Tract 1. Point to Potential access gap and the two explanation boxes. Scroll slowly to the underlying indicators if needed.

**Say:**

“Census Tract 1 is marked as a potential access gap. The explanation shows both parts of the rule: evidence of elevated health need or social barriers, together with an official shortage or underserved-area designation. This is a published screening rule, so I can inspect why the result appeared. Nearby facilities are context; counting map pins does not decide the flag. The result is a planning signal, not a diagnosis or proof that someone cannot get an appointment.”

## 1:35–2:15 — Make the evidence inspectable

**Show:** Open See full evidence and sources. Pause on a value, its cutoff and source link. Show the source date and limitations. Open one publisher link if it is ready and returns promptly, then return to CareAtlas.

**Say:**

“Here I can inspect the inputs, thresholds and publisher links. The pipeline combines Census geography, CDC health estimates and social vulnerability data, and HRSA shortage records. The SVI ranks here are relative to New Jersey. These datasets have different dates and limitations, and missing required evidence stays unknown. That distinction matters: a confident-looking map should never hide the uncertainty behind it.”

## 2:15–2:50 — Take the explanation with you

**Show:** Return to the brief, click Copy link, and open that URL in a new tab to show the selection restored. Return and demonstrate Print brief or the tract JSON download, whichever you verified before recording. Briefly show the actual preview or downloaded file.

**Say:**

“A resident can keep the context instead of losing it when the map closes. This shared link reopens the selected area. The brief also provides print and evidence-export controls, so the question and its sources can be revisited or brought into a conversation. The goal is to make the evidence easier to examine and discuss.”

## 2:50–3:30 — Show the engineering contribution

**Show:** Switch to docs/submission/contribution.md and its pipeline diagram. Then briefly show the README setup/test commands and scripts/applyAccessGapRule.mjs in the repository. Avoid scrolling through unreadable walls of code.

**Say:**

“Behind the interface is a reproducible pipeline: official sources, geographic joins, an explicit rule, validated tract records, and resident-facing briefs. County-sized files and a town crosswalk make the evidence navigable. The repository includes the data and fixtures needed to run the core application and tests locally. Automated checks cover consistency and behavior, and a sensitivity analysis shows how classifications change when thresholds change.”

## 3:30–4:00 — Close with a credible next step

**Show:** Return to the tract explanation and map. End on the live application, with its name visible.

**Say:**

“I developed CareAtlas as a solo project, with ChatGPT and Codex assisting development and testing. Its next step is real resident usability sessions and an independent methods review; I am not claiming those are already complete. CareAtlas turns scattered public records into a question someone can explore, verify and share—starting with their own town.”

## Final recording check

- Keep the finished video between 2 and 5 minutes; aim for 3:45–4:15.
- Show actual interactions, legible text and the successful link/export behavior you describe. Re-record mistakes rather than claiming an unobserved result.
- Add English captions if available and verify dataset names and numbers in auto-generated captions.
- Do not call the app clinically validated, claim demonstrated health impact, or describe it as an ML prediction model. The optional Gemini explainer is disabled and is not part of the screening calculation.
- This new recording will replace the earlier screenshot-based synthetic-narration walkthrough as the intended submission video. Keep the older artifact clearly described if it remains in the repository.
