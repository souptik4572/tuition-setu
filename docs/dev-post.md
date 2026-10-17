---
title: "TuitionSetu: a tutor's Sunday of WhatsApp updates, written by Gemma on her own laptop"
published: false
tags: hf26challenge, ai, opensource, nextjs
description: Turn a private tutor's shorthand class notes into checked WhatsApp updates for parents, in Bengali, Hindi or English, with an open-weight model that never leaves the laptop.
---

<!--
Before publishing:
1. Paste this into DEV's Side Hustle submission template (keep the template's first line and headings if they differ).
2. Upload docs/demo.gif and docs/setup.gif in the DEV editor and replace the two image URLs below.
3. Replace every TODO with your own words. Delete these comments.
4. Set the editor's AI Disclosure control to match the note at the end.
-->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge: Week 2, Side Hustle](https://dev.to/challenges/hf26).*

## What I Built

<!-- TODO: open with the real person this is for, in two or three sentences: who they are, how many students, what their Sunday looks like. The paragraph below is the composite from the README; keep it only if there's no real story. -->

Mita teaches Maths to 30 children from home. After every batch she jots something like:

```
Riya ch5 test 14/20 careless in algebra, missed HW twice; Arjun absent
```

Parents expect a WhatsApp update every week, in Bengali, Hindi or English. So on Sunday evening she turns a week of those scribbles into 30 polite, specific messages. It takes about two hours.

**TuitionSetu does the Sunday part.** She types her notes the way she always has, on her phone or laptop. A local model works out who each line is about and every score. On report day it writes each parent's update in the parent's language. Code checks every number against her notes, and then she reads, approves and taps **Send on WhatsApp**.

**Who pays, and why.** Home tuition is a common side income for teachers in India, and regular updates to parents are part of keeping students. A tutor with 30 students would pay a small monthly fee (I'm thinking ₹99, about a dollar) to get Sunday evening back and to send updates that sound like her and quote the right numbers. That price only works because there is no per-message AI bill: the model runs on the laptop she already owns.

## Demo

<!-- TODO: upload docs/demo.mp4 to YouTube (unlisted is fine) and put its URL here. -->
{% embed https://www.youtube.com/watch?v=TODO %}

The four-minute video above is the whole thing, start to finish, recorded from the real app and model: setup on a fresh clone, the setup wizard, a note with a nickname, a new student and a missing total, every parent's update, a flagged number, sending, completing the week, the sent messages, the phone, and dark mode. Model waits are sped up 2× where a badge says so.

The short version:

![A typed note about five students becomes checked WhatsApp updates: Bengali streaming, a wrong number flagged, approved and sent](TODO-upload-docs/demo.gif)

In the GIF: Mita types one note about five students. Gemma reads it in about 17 seconds and writes Riya's update in Bengali. A score changed by mistake (80% → 90%) is flagged before anyone sees it. She approves, WhatsApp opens with the message ready, and she presses Send herself. Everything runs on one laptop, with no internet needed.

There's no hosted demo, on purpose: the point is that children's names, marks and parents' phone numbers never leave the tutor's laptop. Trying it takes two commands:

![./setup.sh on a fresh clone: checks Node and Ollama, installs, downloads the model, builds, in 17 seconds when the model is already there](TODO-upload-docs/setup.gif)

## Code

{% embed https://github.com/souptik4572/tuition-setu %}

```bash
git clone https://github.com/souptik4572/tuition-setu.git && cd tuition-setu && ./setup.sh
./start.sh            # or ./start.sh --lan to use it from a phone on the same Wi-Fi
```

You need Node 22+ and [Ollama](https://ollama.com). The first run downloads the model (about 6.6 GB). On my laptop, with the model already downloaded, setup took 17 seconds.

## How I Built It

**The model writes; code checks.** Only two steps use the model: reading messy shorthand, and writing a warm paragraph in Bengali. Everything a parent could act on is plain code.

1. **Type a note.** It's saved instantly, even if the AI engine is off.
2. **Extract (Gemma).** The model returns JSON: who, topics, scores, homework, attendance.
3. **Validate (code).** Every number the model returns must appear in the line it came from, or it's removed. A score with no total, or a name it doesn't know, goes to **Needs you** instead of being guessed.
4. **Resolve names (code).** Exact name, saved nickname ("Riyu"), or close spelling ("Payal" → Payel). Anything unsure is asked.
5. **Facts (code).** This week's scores, percentages and the trend, worked out from the confirmed notes.
6. **Draft (Gemma).** Only the body, in the parent's language, from those facts. It streams on screen.
7. **Guard (code).** Every number in the draft must be in the facts, including Bengali and Devanagari digits. No other child may be named, and the language must be right.
8. **Assemble (code).** The title, greeting, fee line and sign-off come from templates, never from the model.
9. **The tutor approves**, and a `wa.me` link opens WhatsApp with the text. TuitionSetu never sends anything on its own.

The guard caught Gemma for real while I was recording the demo. Its advice said "practicing 2-3 short word problems together each evening", and "2" and "3" aren't in Mita's notes, so the update was flagged. Here it's harmless advice, so the tutor can dismiss the warning (the dismissal is recorded) or edit the text. What she can't do is approve a number she hasn't seen.

**Choosing the model by measurement.** I wrote an eval harness (`npm run eval`): 10 real-style notes covering Hinglish, Bengali in English letters, one-liners, nicknames, a date that looks like a score, typos in names and an unknown student. It runs the actual extract, validate and resolve code and scores the result:

| Model | Prompt | Students | Scores | Extra questions | Names as written | Median time |
|---|---|---|---|---|---|---|
| gemma4 (E4B) | v1 | 100% | 100% | 0 | 56.5% | 7.4 s |
| **gemma4 (E4B)** | **v2** | **100%** | **100%** | **0** | **91.3%** | **7.8 s** |
| qwen3.5:9b | v1 | 95.7% | 100% | 1 | 77.3% | 23.6 s |
| qwen3.5:9b | v2 | 100% | 100% | 0 | 82.6% | 23.7 s |

Two things came out of it. First, Gemma kept "helpfully" correcting names ("Payal" → "Payal Dutta"), which broke the check that the model's quote really appears in the note. A one-rule prompt change ("copy the name exactly as the tutor spelled it") took names-as-written from 56% to 91%. Second, with that prompt Gemma sometimes echoed the prompt's "Class date:" header as a line about no one. That would have become a pointless question for the tutor, so the validator now drops any such line that isn't in the note. Gemma matched Qwen on accuracy and was three times faster, so it does both jobs.

**The rest of the stack:** Next.js 16 and React 19, SQLite through Drizzle, Zod for every model reply, and Ollama for the models. There's a PIN-protected local sign-in, a `--lan` mode so the tutor's phone can use the laptop, and 243 tests. Models are swapped with one line in `.env.local`.

## Why Open Innovation Matters Here

- **Children's data stays home.** The notes, marks and parents' numbers live in a SQLite file on the tutor's laptop. In my QA run, the app's only network connections were to itself and to Ollama on 127.0.0.1. A closed API would mean sending every child's marks to a third party.
- **₹0 per message makes ₹99 a month possible.** Thirty updates a week, every week, costs nothing to generate. There's no API key to buy and no bill that grows with her student list.
- **Bengali quality is something I can measure and swap.** If a better open model for Bengali appears tomorrow, it's one line in `.env.local`, and the eval tells me whether it really is better before any parent sees it.
- **No lock-in.** It's Apache-2.0, the data is a file she owns, and once it's set up it needs no internet.

## My First User

<!-- TODO after the session (docs/first-user.md): who they are (with permission), how long their usual Sunday takes vs. the time with TuitionSetu, how many updates they edited, what the guard caught, whether they'd pay ₹99 a month, what they asked for next, and one quote in their words. Real numbers beat adjectives. -->

## Prize Categories

**Best Use of Gemma.** Gemma 4 (E4B, `gemma4:latest` in Ollama) does both model jobs: reading the tutor's shorthand into structured JSON, and writing each parent's update in Bengali, Hindi or English. I chose it over Qwen 3.5 9B by measurement (table above): just as accurate on my fixtures, three times faster, and small enough for a tutor's 16 GB laptop.

<!-- TODO: keep or rewrite this disclosure so it's true for you. -->
*I built TuitionSetu with Claude Code as my pair programmer, and drafted this post with its help. Every number above comes from the project's tests, evals and my QA run.*
