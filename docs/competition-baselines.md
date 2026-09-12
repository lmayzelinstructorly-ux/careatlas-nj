# CareAtlas competition baselines and contribution ledger

This record separates the pre-existing CareAtlas foundation from work completed
inside a competition period. A baseline tag is evidence about repository state;
it is not proof that a competition permits a pre-existing project.

The GitHub repository is currently private. Before using these tags as judge-
visible evidence, either grant the organizer/reviewers repository access or
make the repository public through a separate, explicit visibility decision.

The scheduled baseline workflow selects the final `origin/main` commit whose
committer timestamp is at or before the official start. For events that had
already begun when this system was added on August 31, 2026, the tags are
explicitly reconstructed from existing immutable Git history. Their annotated
tag creation dates are later than the event starts and must not be represented
otherwise.

Automation verification: the GitHub Actions workflow completed a successful
[manual verification run](https://github.com/lmayzelinstructorly-ux/CareAtlas/actions/runs/33448063828)
on August 31, 2026, at commit `e86f0a70239a`. Scheduled runs remain responsible
for the future event-start tags.

## Baseline table

| Competition | Official start | Baseline tag | Baseline commit/status |
| --- | --- | --- | --- |
| Global Innovation Build Challenge V2 | July 11, 2026, 12:00 p.m. UTC+8 | `competition/gibc-v2-2026-baseline` | Reconstructed: `e0b4f96de5cb` |
| Hack for Humanity Summer 2026 | August 7, 2026, 12:00 p.m. EDT | `competition/hack-for-humanity-summer-2026-baseline` | Reconstructed: `2dd37b987e82` |
| UnivaBio | August 7, 2026, 12:00 a.m. EDT | `competition/univabio-2026-baseline` | Reconstructed: `2dd37b987e82` |
| NextStep Hacks 2026 | August 21, 2026, 12:00 a.m. EDT | `competition/nextstep-hacks-2026-baseline` | Reconstructed: `2dd37b987e82` |
| FirstCommit | August 21, 2026, 12:00 a.m. EDT | `competition/firstcommit-2026-baseline` | Reconstructed: `2dd37b987e82` |
| GatewayHacks 2026 | September 1, 2026, 12:00 a.m. EDT | `competition/gatewayhacks-2026-baseline` | Tagged automatically: `d1b99d4348cf` |
| CSC Back-to-School Hackathon | September 4, 2026, 12:00 a.m. PDT | `competition/csc-back-to-school-2026-baseline` | Tagged automatically: `27798f1a79ec` |
| Lake Oswego Hacks | September 26, 2026, 9:00 a.m. PDT | `competition/lake-oswego-hacks-2026-baseline` | Scheduled; fill from the tag after creation |
| ForgeHacks Online 2026 | October 3, 2026, 12:00 p.m. EDT | `competition/forgehacks-online-2026-baseline` | Scheduled; fill from the tag after creation |
| Bridge the Gap Hacks | November 15, 2026, 12:00 a.m. PST | `competition/bridge-the-gap-hacks-2026-baseline` | Scheduled; fill from the tag after creation |

Official schedules: [GIBC V2](https://gibc-v2.devpost.com/details/dates),
[Hack for Humanity](https://hack-for-humanity-summer-26.devpost.com/details/dates),
[UnivaBio](https://univabio.devpost.com/details/dates),
[NextStep](https://nextstep2026.devpost.com/details/dates),
[FirstCommit](https://firstcommit.devpost.com/details/dates),
[GatewayHacks](https://gatewayhacks-2026.devpost.com/details/dates),
[CSC Back-to-School](https://csc-back-to-school.devpost.com/details/dates),
[Lake Oswego Hacks](https://lake-oswego-hacks.devpost.com/details/dates),
[ForgeHacks](https://forgehacks-2026.devpost.com/details/dates), and
[Bridge the Gap](https://sq-hacks.devpost.com/details/dates).

## Pre-existing versus competition-period work

Copy one row per proposed submission and replace every placeholder before
submitting. Link to commits, not just prose.

| Competition | Pre-existing foundation disclosed | New work completed during event | Commit range and tests | Organizer reuse approval |
| --- | --- | --- | --- | --- |
| GIBC V2 | Complete CareAtlas foundation predates the event | None claimed | Existing app is disqualified by the published creation-period rule | Not ambiguous; do not submit CareAtlas |
| Hack for Humanity | Complete CareAtlas foundation predates the event | None claimed | Not eligible as the existing app under the published rule | Not ambiguous; do not submit unchanged |
| UnivaBio | Complete CareAtlas foundation through the baseline | Not yet recorded as competition-specific work | `baseline..submission`; pending | Pending written answer |
| NextStep | Complete CareAtlas foundation through the baseline | Not yet recorded as competition-specific work | `baseline..submission`; pending | Published rules permit disclosed continuation |
| FirstCommit | Complete CareAtlas foundation predates the event | None claimed | Existing app does not satisfy the published creation rule | Not ambiguous; build a new project if entering |
| GatewayHacks | Complete CareAtlas foundation predates the event | None claimed | Existing app does not satisfy the published event-creation rule | Not ambiguous; build a new project if entering |
| CSC Back-to-School | Complete CareAtlas foundation through the baseline | Not started | `baseline..submission`; pending | Published rules require disclosure and substantial new work |
| Lake Oswego Hacks | Complete CareAtlas foundation through the baseline | Not started | `baseline..submission`; pending | Published rules require significant new event work |
| ForgeHacks | Complete CareAtlas foundation through the baseline | Not started | `baseline..submission`; pending | Published rules allow a disclosed pre-existing foundation |
| Bridge the Gap | Complete CareAtlas foundation predates the event | None claimed | Existing app does not satisfy the published creation rule | Not ambiguous; build during November 15–20 if entering |

Commits made after an event starts are not automatically competition work. The
August 30 doctor-office pilot commits, for example, were not created in response
to these hackathons and must not be described as such merely because their dates
fall inside some event windows.

## Submission disclosure template

> CareAtlas existed before this event. The pre-event state is preserved at
> `[baseline tag]` (`[commit]`). For this competition I built `[specific new
> functionality]` in `[commit range]`. The reused foundation includes `[brief
> list]`; the new work includes `[brief list]`. I used `[AI/tools/mentors]` for
> `[accurate description]` and can explain the submitted implementation.

Before submitting, verify the tag on GitHub, give reviewers access to the tag,
replace every placeholder, attach the organizer's written answer when reuse was
ambiguous, and make sure the demo only credits work that can be shown in the
commit range.
