import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VaultEnvelopeSchema, notFoundError, validationProblemFromZodError } from '@aeris/shared-schemas';
import type { VaultRepository } from '../repositories/vault.repository';
import { sendProblem } from '../plugins/error-handler';

const RegisterVaultRequestSchema = z.object({
  accountId: z.string().uuid(),
  envelope: VaultEnvelopeSchema,
});

const AccountIdParamsSchema = z.object({ accountId: z.string().uuid() });

/**
 * Speichert und liefert ausschließlich das opake VaultEnvelope
 * (Salt, KDF-Parameter, gewrappter DEK). Der Server sieht niemals die
 * Passphrase oder den unverschlüsselten DEK.
 */
export function registerVaultRoutes(app: FastifyInstance, repository: VaultRepository): void {
  app.post('/v1/vault', async (request, reply) => {
    const parsed = RegisterVaultRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendProblem(reply, validationProblemFromZodError(parsed.error, request.url));
      return;
    }
    repository.save(parsed.data.accountId, parsed.data.envelope);
    reply.code(201).send({ accountId: parsed.data.accountId });
  });

  app.get('/v1/vault/:accountId', async (request, reply) => {
    const params = AccountIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      sendProblem(reply, validationProblemFromZodError(params.error, request.url));
      return;
    }
    const envelope = repository.findByAccountId(params.data.accountId);
    if (!envelope) {
      throw notFoundError('Vault', request.url);
    }
    reply.send({ envelope });
  });
}
