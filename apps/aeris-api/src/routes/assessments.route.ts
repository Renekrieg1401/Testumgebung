import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AssessmentSyncEnvelopeSchema, validationProblemFromZodError } from '@aeris/shared-schemas';
import type { AssessmentRepository } from '../repositories/assessment.repository';
import { sendProblem } from '../plugins/error-handler';

const AccountIdParamsSchema = z.object({ accountId: z.string().uuid() });

/**
 * Nimmt ausschließlich opake Ciphertext-Envelopes entgegen. Konflikte
 * zwischen Geräten werden serverseitig mit derselben deterministischen
 * Vektoruhr-Logik aufgelöst, die auch die Clients nutzen (siehe
 * resolveAssessmentConflict in @aeris/shared-schemas), damit alle
 * Teilnehmer unabhängig vom Sync-Zeitpunkt konvergieren.
 */
export function registerAssessmentRoutes(app: FastifyInstance, repository: AssessmentRepository): void {
  app.post('/v1/assessments', async (request, reply) => {
    const parsed = AssessmentSyncEnvelopeSchema.safeParse(request.body);
    if (!parsed.success) {
      sendProblem(reply, validationProblemFromZodError(parsed.error, request.url));
      return;
    }
    const resolved = repository.upsertWithConflictResolution(parsed.data);
    reply.code(200).send({ envelope: resolved });
  });

  app.get('/v1/assessments/:accountId', async (request, reply) => {
    const params = AccountIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      sendProblem(reply, validationProblemFromZodError(params.error, request.url));
      return;
    }
    const envelopes = repository.listByAccountId(params.data.accountId);
    reply.send({ envelopes });
  });
}
