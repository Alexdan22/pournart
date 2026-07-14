export const AURORA_REVIEW_NOTE_LIMIT = 2_000;
export const REVIEW_NOTE_WARNING =
  "Do not enter customer information, passwords, tokens, credentials or secrets.";

export type AuroraReviewState = "NEW" | "ACCEPTED" | "NEEDS_CHANGES" | "RESOLVED";
export type AuroraReviewTarget =
  | Readonly<{ scope: "evaluation" }>
  | Readonly<{ scope: "decision"; decisionId: string }>;

export const AURORA_REVIEW_TRANSITIONS = {
  NEW: ["ACCEPTED", "NEEDS_CHANGES"],
  ACCEPTED: ["NEEDS_CHANGES"],
  NEEDS_CHANGES: ["RESOLVED", "ACCEPTED"],
  RESOLVED: ["NEEDS_CHANGES", "ACCEPTED"],
} as const satisfies Readonly<Record<AuroraReviewState, readonly AuroraReviewState[]>>;

export function isAuroraReviewTransitionAllowed(
  current: AuroraReviewState,
  next: AuroraReviewState,
) {
  return (AURORA_REVIEW_TRANSITIONS[current] as readonly AuroraReviewState[]).includes(next);
}

export function validateReviewNote(value: string | undefined, newState: AuroraReviewState) {
  if (value === undefined || value === "") {
    if (newState === "NEEDS_CHANGES") throw new ReviewNoteValidationError("REVIEW_NOTE_REQUIRED");
    return null;
  }
  const note = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (!note && newState === "NEEDS_CHANGES")
    throw new ReviewNoteValidationError("REVIEW_NOTE_REQUIRED");
  if (note.length > AURORA_REVIEW_NOTE_LIMIT)
    throw new ReviewNoteValidationError("REVIEW_NOTE_TOO_LONG");
  for (const character of note) {
    const code = character.charCodeAt(0);
    if ((code < 32 && code !== 9 && code !== 10) || (code >= 127 && code <= 159))
      throw new ReviewNoteValidationError("REVIEW_NOTE_CONTROL_CHARACTER");
  }
  if (containsUnsafeNotePattern(note))
    throw new ReviewNoteValidationError("REVIEW_NOTE_SENSITIVE_PATTERN");
  return note || null;
}

export class ReviewNoteValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ReviewNoteValidationError";
  }
}

function containsUnsafeNotePattern(note: string) {
  return [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /(?:\+?\d[\s().-]*){8,}/,
    /\b(?:password|passcode|token|secret|credential|api[_ -]?key)\s*[:=]/i,
    /\bbearer\s+[A-Za-z0-9._~+/-]+=*/i,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
    /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{8,}\b/i,
  ].some((pattern) => pattern.test(note));
}
