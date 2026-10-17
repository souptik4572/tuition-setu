# Extraction eval · gemma4:latest · prompt v2

2026-10-17 · 10 cases · ollama · 16 GB RAM

| Metric | Result | Bar (§11.3) |
|---|---|---|
| Student attribution | 100% (23/23) | ≥ 95% ✓ |
| Assessment exact match | 100% (18/18) | ≥ 95% ✓ |
| Numbers not in the notes after S5 | 0 (S5 removed 5) | 0 ✓ |
| Unknown student left for the tutor | 1/1 | all ✓ |
| Valid JSON on first try | 100% | ≥ 90% ✓ |
| Extra questions for the tutor (Needs you) | 0 | — |
| Names copied as written | 91.3% (21/23) | — |
| Quotes not found in the note (V1) | 0 | — |
| Latency p50 / p95 | 7.8 s / 13.7 s | recorded |

## Cases

### 01-clean-english

> Riya ch5 test 14/20 careless in algebra, missed HW twice; Arjun absent; Tanmoy improving in fractions, quiz 17/25

9034 ms · students 3/3 · scores 2/2

- Read: ‘Riya’ → Riya Sen (exact) [number_not_in_notes]; ‘Arjun’ → Arjun Das (exact); ‘Tanmoy’ → Tanmoy Ghosh (exact)

### 02-hinglish

> Kabir ne ch4 test mein 11/15 liya, thoda careless tha. Ishita ka HW complete nahi tha. Payel aaj late aayi

8279 ms · students 3/3 · scores 1/1

- Read: ‘Kabir’ → Kabir Mehta (exact); ‘Ishita’ → Ishita Roy (exact) [number_not_in_notes]; ‘Payel’ → Payel Dutta (exact)

### 03-roman-bengali

> Tanmoy bhalo korche fractions e, quiz e 18/25 peyeche. Riya aaj ashe ni.

6299 ms · students 2/2 · scores 1/1

- Read: ‘Tanmoy’ → Tanmoy Ghosh (exact); ‘Riya’ → Riya Sen (exact) [number_not_in_notes]

### 04-one-line

> Riya 14/20 Arjun 16/20 Tanmoy 12/25 Ishita 9/10

13738 ms · students 4/4 · scores 4/4

- Read: ‘Riya’ → Riya Sen (exact); ‘Arjun’ → Arjun Das (exact); ‘Tanmoy’ → Tanmoy Ghosh (exact); ‘Ishita’ → Ishita Roy (exact)

### 05-nickname

> Riyu did ex 5.2 well, test 15/20

5497 ms · students 1/1 · scores 1/1

- Read: ‘Riyu’ → Riya Sen (alias)

### 06-no-total

> Riya 14 in the class test, Arjun 17

7914 ms · students 2/2 · scores 2/2

- Read: ‘Riya’ → Riya Sen (exact) [missing_total]; ‘Arjun’ → Arjun Das (exact) [missing_total]

### 07-date-not-score

> Kabir test on 12/10, revise ch3 before that. Payel ratio quiz 7/10

6710 ms · students 2/2 · scores 1/1

- Read: ‘Kabir Mehta’ → Kabir Mehta (exact); ‘Payel Dutta’ → Payel Dutta (exact)

### 08-decimal-out-of

> Ishita scored 14.5 out of 20 in the unit test. Arjun got 8 out of 10 in the quiz

7476 ms · students 2/2 · scores 2/2

- Read: ‘Ishita’ → Ishita Roy (exact) [number_not_in_notes, number_not_in_notes]; ‘Arjun’ → Arjun Das (exact)

### 11-unknown-student

> Sohini 16/20 good in geometry. Riya 12/20 in the same test

6702 ms · students 2/2 · scores 2/2

- Read: ‘Sohini’ → Needs you (unmatched); ‘Riya’ → Riya Sen (exact)

### 13-typo-names

> Payal ratio quiz 6/10. Tanmay fractions test 15/25

7819 ms · students 2/2 · scores 2/2

- Read: ‘Payal’ → Payel Dutta (fuzzy); ‘Tanmay’ → Tanmoy Ghosh (fuzzy)
