import type { FastifyInstance, FastifyReply } from 'fastify';
import { DomainError, internalProblem, type ProblemDetails } from '@aeris/shared-schemas';

export function sendProblem(reply: FastifyReply, problem: ProblemDetails): void {
  reply.code(problem.status).header('content-type', 'application/problem+json').send(problem);
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      sendProblem(reply, error.problem);
      return;
    }
    request.log.error({ err: error }, 'Unbehandelter Fehler');
    sendProblem(reply, internalProblem(request.url));
  });

  app.setNotFoundHandler((request, reply) => {
    sendProblem(reply, {
      type: 'https://aeris.dipa.de/problems/route-not-found',
      title: 'Route nicht gefunden',
      status: 404,
      detail: `Keine Route für ${request.method} ${request.url}`,
      instance: request.url,
    });
  });
}
