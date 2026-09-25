export const LEARNING_STATE_SCHEMA_VERSION = 1 as const;

export type LearningStatus = "NEW" | "ACTIVE" | "WEAK" | "MASTERED" | "RELEARNING";
export type LearningEventType =
  | "correct"
  | "wrong"
  | "unknown"
  | "confused"
  | "hint"
  | "mastered"
  | "relearning"
  | "image_used"
  | "image_helped";

export interface LearningTargetState {
  key: string;
  status: LearningStatus;
  attempts: number;
  correct: number;
  wrong: number;
  unknown: number;
  confused: number;
  hints: number;
  imageUses: number;
  imageHelped: number;
  correctStreak: number;
  lastEvent: LearningEventType | null;
  lastStudiedAt: number;
  lastResponseMs: number | null;
  lastQuestionType: string | null;
}

export interface SenseLearningState {
  schemaVersion: typeof LEARNING_STATE_SCHEMA_VERSION;
  revision: number;
  legacyMasteredMigrated: boolean;
  targets: Record<string, LearningTargetState>;
}

export interface LearningEventInput {
  targetKey: string;
  type: LearningEventType;
  occurredAt?: number;
  responseMs?: number;
  questionType?: string;
  usedHint?: boolean;
}

export function createEmptySenseLearningState(): SenseLearningState {
  return {
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    revision: 0,
    legacyMasteredMigrated: false,
    targets: {},
  };
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function isStatus(value: unknown): value is LearningStatus {
  return ["NEW", "ACTIVE", "WEAK", "MASTERED", "RELEARNING"].includes(String(value));
}

function isEvent(value: unknown): value is LearningEventType {
  return ["correct", "wrong", "unknown", "confused", "hint", "mastered", "relearning", "image_used", "image_helped"].includes(String(value));
}

export function parseSenseLearningState(value: unknown): SenseLearningState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== LEARNING_STATE_SCHEMA_VERSION ||
      !raw.targets || typeof raw.targets !== "object" || Array.isArray(raw.targets)) return null;
  const state = createEmptySenseLearningState();
  state.revision = count(raw.revision);
  state.legacyMasteredMigrated = raw.legacyMasteredMigrated === true;
  for (const [key, candidate] of Object.entries(raw.targets as Record<string, unknown>)) {
    if (!key || !candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const item = candidate as Record<string, unknown>;
    if (!isStatus(item.status)) return null;
    state.targets[key] = {
      key,
      status: item.status,
      attempts: count(item.attempts),
      correct: count(item.correct),
      wrong: count(item.wrong),
      unknown: count(item.unknown),
      confused: count(item.confused),
      hints: count(item.hints),
      imageUses: count(item.imageUses),
      imageHelped: count(item.imageHelped),
      correctStreak: count(item.correctStreak),
      lastEvent: isEvent(item.lastEvent) ? item.lastEvent : null,
      lastStudiedAt: count(item.lastStudiedAt),
      lastResponseMs: typeof item.lastResponseMs === "number" && Number.isFinite(item.lastResponseMs) ? Math.max(0, Math.floor(item.lastResponseMs)) : null,
      lastQuestionType: typeof item.lastQuestionType === "string" ? item.lastQuestionType : null,
    };
  }
  return state;
}

export function isReadableSenseLearningState(value: unknown): boolean {
  return parseSenseLearningState(value) !== null;
}

export function getLearningTargetState(
  state: SenseLearningState,
  targetKey: string,
): LearningTargetState {
  return state.targets[targetKey] ?? {
    key: targetKey,
    status: "NEW",
    attempts: 0,
    correct: 0,
    wrong: 0,
    unknown: 0,
    confused: 0,
    hints: 0,
    imageUses: 0,
    imageHelped: 0,
    correctStreak: 0,
    lastEvent: null,
    lastStudiedAt: 0,
    lastResponseMs: null,
    lastQuestionType: null,
  };
}

export function applyLearningEvent(
  state: SenseLearningState,
  input: LearningEventInput,
): SenseLearningState {
  if (!input.targetKey || !isEvent(input.type)) return state;
  const previous = getLearningTargetState(state, input.targetKey);
  const target = { ...previous };
  const isAnswer = ["correct", "wrong", "unknown", "confused"].includes(input.type);
  if (isAnswer) target.attempts += 1;
  if (input.type === "correct") {
    target.correct += 1;
    target.correctStreak += 1;
    if (target.status === "NEW") target.status = "ACTIVE";
    if ((target.status === "WEAK" || target.status === "RELEARNING") &&
        target.correctStreak >= 2 && !input.usedHint) target.status = "ACTIVE";
  } else if (input.type === "wrong") {
    target.wrong += 1;
    target.correctStreak = 0;
    target.status = previous.status === "MASTERED" ? "RELEARNING" : "WEAK";
  } else if (input.type === "unknown") {
    target.unknown += 1;
    target.correctStreak = 0;
    target.status = previous.status === "MASTERED" ? "RELEARNING" : "WEAK";
  } else if (input.type === "confused") {
    target.confused += 1;
    target.correctStreak = 0;
    target.status = previous.status === "MASTERED" ? "RELEARNING" : "WEAK";
  } else if (input.type === "hint") {
    target.hints += 1;
    if (target.status === "NEW") target.status = "ACTIVE";
  } else if (input.type === "mastered") {
    target.status = "MASTERED";
    target.correctStreak = Math.max(target.correctStreak, 1);
  } else if (input.type === "relearning") {
    target.status = "RELEARNING";
    target.correctStreak = 0;
  } else if (input.type === "image_used") {
    target.imageUses += 1;
  } else if (input.type === "image_helped") {
    target.imageHelped += 1;
  }
  target.lastEvent = input.type;
  target.lastStudiedAt = Math.max(0, Math.floor(input.occurredAt ?? Date.now()));
  if (typeof input.responseMs === "number" && Number.isFinite(input.responseMs))
    target.lastResponseMs = Math.max(0, Math.floor(input.responseMs));
  if (input.questionType) target.lastQuestionType = input.questionType;
  return {
    ...state,
    revision: state.revision + 1,
    targets: { ...state.targets, [input.targetKey]: target },
  };
}

export function learningPriority(target: LearningTargetState): number {
  if (target.status === "MASTERED") return -1;
  const base = target.status === "RELEARNING" ? 120
    : target.status === "WEAK" ? 90
    : target.status === "ACTIVE" ? 25
    : 10;
  return base + Math.min(target.wrong * 7 + target.unknown * 9 + target.confused * 6 + target.hints * 2, 60);
}

export function masteredTargetKeys(state: SenseLearningState): Set<string> {
  return new Set(Object.values(state.targets).filter(target => target.status === "MASTERED").map(target => target.key));
}
