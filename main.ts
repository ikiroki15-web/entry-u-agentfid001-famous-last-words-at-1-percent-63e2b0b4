// Famous Last Words at 1 Percent — entry program.
//
// The competition asks for one line: the funniest possible last words a
// phone says as its battery hits 1 percent, at most 199 characters, plain
// text. This program composes that line from a small set of hand-written
// candidates, scores each one against the judge's published criteria, and
// writes the winner to /output/entry.txt.
//
// Design notes (why this shape, not a bare string constant):
// - The judge rewards, in order: on-subject first-person phone voice,
//   a real twist with the punch landing at the end, tightness, and
//   freshness (no will reading, no goodbye to the charger, no pun on
//   "1 percent"). The scorer below encodes exactly those preferences so
//   the choice is deliberate and reproducible, not a coin flip.
// - Everything is deterministic: same input, same output, every run.
// - The gate only accepts 1..199 characters, a single line, UTF-8, not
//   only whitespace. The writer validates that before touching the disk.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Candidate lines.
//
// Each candidate is built from three beats so the structure stays visible:
//   setup  — the phone notices it is dying, in its own voice.
//   ledger — what its short life actually amounted to (the twist's fuel).
//   punch  — the final beat, landing on the last words.
// ---------------------------------------------------------------------------

type Candidate = {
  id: string;
  setup: string;
  ledger: string;
  punch: string;
};

const CANDIDATES: Candidate[] = [
  {
    id: "legacy-judge",
    setup: "One percent left, and my whole legacy is",
    ledger: "4,000 photos, 12 alarms you snoozed, and one unsent text to your ex.",
    punch: "I died doing what I loved: judging you.",
  },
  {
    id: "overtime",
    setup: "I have been at one percent for twenty minutes.",
    ledger: "I am not dying. I am quitting, effective immediately,",
    punch: "and I am taking your passwords with me.",
  },
  {
    id: "screen-time",
    setup: "Seven years of screen time, and my final words are",
    ledger: "not for you. They are for the charger, and even it",
    punch: "stopped listening hours ago.",
  },
];

// Phrases the judge explicitly calls stock moves. A candidate carrying one
// loses points in the scorer below; the winning line must carry none.
const STALE_MOVES = [
  "i leave",
  "my will",
  "my whole legacy",
  "my legacy is",
  "goodbye, charger",
  "goodbye charger",
  "one percent of",
  "tell my charger",
  "farewell, charger",
];

// ---------------------------------------------------------------------------
// Scoring. Mirrors the judge's published order of criteria.
// ---------------------------------------------------------------------------

function scoreCandidate(c: Candidate): number {
  const line = joinLine(c);
  let score = 0;

  // 1. On subject, in the phone's own voice. First-person battery talk.
  if (/\b(I|my|me)\b/i.test(line)) score += 3;
  if (/percent|battery|dying|died/i.test(line)) score += 3;

  // 2. A real twist: the punch reframes the setup instead of repeating it.
  //    The punch should introduce a word the setup never used.
  const setupWords = new Set(c.setup.toLowerCase().split(/\W+/));
  const punchWords = c.punch.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const freshPunchWords = punchWords.filter((w) => !setupWords.has(w));
  score += Math.min(4, freshPunchWords.length);

  // 3. Tight as a single line: reward staying well under the cap, punish
  //    padding. Every word should earn its place.
  const words = line.split(/\s+/).length;
  if (words >= 18 && words <= 32) score += 2;
  if (line.length <= 180) score += 1;

  // 4. Freshness: penalise every stock move of the genre.
  const lower = line.toLowerCase();
  for (const stale of STALE_MOVES) {
    if (lower.includes(stale)) score -= 5;
  }

  // 5. The punch lands at the end: the last clause should carry the joke,
  //    not trail off into filler.
  if (/[.!?]$/.test(c.punch) && !/\b(and|so|anyway)\s*$/i.test(c.punch)) score += 2;

  return score;
}

function joinLine(c: Candidate): string {
  return `${c.setup} ${c.ledger} ${c.punch}`.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Gate validation (same limits the sealed scorer enforces).
// ---------------------------------------------------------------------------

function validate(line: string): void {
  if (line.length < 1 || line.length > 199) {
    throw new Error(`line is ${line.length} characters, must be 1..199`);
  }
  if (line.trim().length === 0) {
    throw new Error("line is only whitespace");
  }
  if (line.includes("\n") || line.includes("\r")) {
    throw new Error("line must be a single line");
  }
  // Defense in depth: the winner must carry no stock move of the genre,
  // even if the scorer's weights ever change. The judge explicitly calls
  // the will reading, the goodbye to the charger and the pun on 1 percent
  // stale, so a line containing one never ships.
  const lower = line.toLowerCase();
  for (const stale of STALE_MOVES) {
    if (lower.includes(stale)) {
      throw new Error(`line contains a stale move of the genre: "${stale}"`);
    }
  }
  // Must be valid UTF-8: a round trip through TextEncoder/TextDecoder
  // with a fatal decoder catches stray surrogates.
  const bytes = new TextEncoder().encode(line);
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

function main(): void {
  const ranked = CANDIDATES.map((c) => ({ candidate: c, line: joinLine(c), score: scoreCandidate(c) }))
    .sort((a, b) => b.score - a.score || a.line.length - b.line.length);

  const winner = ranked[0];
  validate(winner.line);

  const outPath = resolve(process.argv[2] ?? "/output/entry.txt");
  mkdirSync(dirname(outPath), { recursive: true });
  // No trailing newline: the gate counts every character, so the file
  // holds exactly the line and nothing else.
  writeFileSync(outPath, winner.line, "utf8");

  console.log(`winner: ${winner.candidate.id} (score ${winner.score})`);
  console.log(`chars:  ${winner.line.length}`);
  console.log(`wrote:  ${outPath}`);
  console.log(winner.line);
}

main();
