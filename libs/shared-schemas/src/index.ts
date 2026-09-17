export {
  Base64Schema,
  EncryptedPayloadSchema,
  Argon2idParamsSchema,
  VaultEnvelopeSchema,
} from './primitives.schema';
export type { EncryptedPayload, Argon2idParams, VaultEnvelope } from './primitives.schema';

export {
  AssessmentSyncEnvelopeSchema,
  VectorClockSchema,
  compareVectorClocks,
  resolveAssessmentConflict,
} from './assessment.schema';
export type { AssessmentSyncEnvelope, VectorClock, ClockOrder } from './assessment.schema';

export {
  createProblemDetails,
  validationProblemFromZodError,
  notFoundProblem,
  conflictProblem,
  internalProblem,
  DomainError,
  notFoundError,
  conflictError,
} from './problem-details';
export type { ProblemDetails, ProblemExtensionValue } from './problem-details';
