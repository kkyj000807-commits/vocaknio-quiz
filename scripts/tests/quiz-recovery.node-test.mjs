import { test } from 'node:test';
import { confirmedQuizRecoveryCase } from '../../tests/helpers/quiz-recovery-cases.mjs';
test('quiz resumes once after confirmed recovery without bypassing conflicts', confirmedQuizRecoveryCase);
