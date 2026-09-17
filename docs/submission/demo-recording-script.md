# CareAtlas NJ: live demo recording script

Target: about 4 minutes, with English narration or accurate English subtitles and a real screen recording. Show all three existing map views. Leave Devpost's video URL blank until the finished recording is hosted and verified.

## Before recording

- Open <https://careatlas.lmayzel930.workers.dev> in Chrome at a readable desktop size. Hide unrelated tabs and notifications.
- Rehearse these current routes: Hospitals & community health centers → Newark City → a facility group; Doctor offices → Dermatology → Edison → View results; Potential gaps → Newark City → View gap tracts → a tract evidence brief.
- Read counts from the screen during the final take. The September 17 snapshot showed 17 listed care locations in the Newark group and four Edison dermatology office locations; later source refreshes may change them.
- Test the link, print and download actions before narrating them. Show only an action that succeeds in the recording.
- Have the public repository README and [contribution and source inventory](contribution.md) ready in separate tabs. Do not show private messages, account settings, credentials or API keys.

## 0:00–0:25 — Start with a resident's question

**Show:** The CareAtlas welcome screen, then the three map-mode tabs.

**Say:** “Healthcare-access information is scattered across facility directories and public-health datasets. I built CareAtlas NJ so someone can start with a New Jersey town, explore recorded care locations, and inspect the evidence behind a screening result. The three views answer different questions.”

## 0:25–1:05 — Hospitals and community health centers

**Show:** Choose Hospitals & community health centers, search Newark, select Newark City, and open a nearby facility group. Pause on a listing's address, contact options and source context.

**Say:** “This view includes source-backed hospitals and HRSA community health centers. Here are the locations recorded around Newark. A person can inspect a listing and use its contact information, but these pins do not represent every place to get care. The map is a starting point for a question, not a guarantee of services or appointments.”

## 1:05–1:50 — Doctor-office pilot

**Show:** Switch to Doctor offices, choose Dermatology, search Edison and select View results. Pause on a clearly named office such as Aura Dermatology at Edison. Open its clinician details and About this listing.

**Say:** “This separate pilot uses a CMS snapshot. I can search by town, ZIP, practice or clinician, open the filtered list directly, and see who is listed for the specialty. The listing links back to its source and shows its dates. It is incomplete and does not tell me whether the office is open, takes my insurance or has appointments.”

## 1:50–2:45 — Explain one tract result

**Show:** Switch to Potential gaps, keep or choose Newark City, click View gap tracts, and select a tract with a published result. Pause on the status, explanation, data values and nearby source links and dates.

**Say:** “The third view uses a transparent screening rule across New Jersey census tracts. This tract's result comes from public indicators of health need or social barriers together with official shortage evidence. I can see the inputs, source dates and limitations instead of trusting a color alone. A potential gap is a planning signal, not a diagnosis or proof that care is unavailable. Facility and office pins never create the flag.”

## 2:45–3:15 — Keep and check the evidence

**Show:** Copy the tract link and open it to show the selection restored. Demonstrate Print brief or a record download that was tested before recording.

**Say:** “A resident can keep the explanation and its sources. This link reopens the selected area, and the brief can be printed or exported. Missing evidence remains unknown; an unflagged tract does not prove that access is adequate.”

## 3:15–3:45 — Show the engineering

**Show:** Briefly show the repository README's pipeline diagram, local setup and test command, plus the source and methods inventory. Avoid scrolling through unreadable code.

**Say:** “Behind the interface is a reproducible pipeline: official data, geographic joins, a versioned rule, validated records and a map that makes the result inspectable. The repository includes setup instructions and automated checks. A sensitivity analysis shows how different thresholds change classifications; it is not a claim of clinical validation.”

## 3:45–4:05 — Close with the honest next step

**Show:** Return to the live CareAtlas map with the project name visible.

**Say:** “I built CareAtlas as a solo project with ChatGPT and Codex assisting development and testing. The next step is resident usability sessions and an independent public-health or GIS review. Those are future work. Today, CareAtlas helps people explore, question and share the public evidence around a place they know.”

## Final check

- Keep the hosted video between 2 and 5 minutes on YouTube, Vimeo or Youku; public or unlisted access is acceptable under the current challenge requirements.
- Use actual, legible interactions. Add English subtitles if narration is not in English, and review any automatic captions for incorrect names or numbers.
- Verify the video link opens without a login and shows the full recording before adding it to Devpost.
- Do not use the older [screenshot-based walkthrough](assets/careatlas-walkthrough.mp4) as the final demo; it does not show a continuous live interaction.
