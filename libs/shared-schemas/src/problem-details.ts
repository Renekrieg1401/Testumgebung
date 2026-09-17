import type { ZodError } from 'zod';

export type ProblemExtensionValue = string | number | boolean | null;

export interface ProblemDetails {
  readonly [key: string]: ProblemExtensionValue | undefined;
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
}

const PROBLEM_TYPE_BASE = 'https://aeris.dipa.de/problems/';

interface CreateProblemDetailsInput {
  readonly slug: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly extensions?: Readonly<Record<string, ProblemExtensionValue>>;
}

export function createProblemDetails(input: CreateProblemDetailsInput): ProblemDetails {
  return {
    type: `${PROBLEM_TYPE_BASE}${input.slug}`,
    title: input.title,
    status: input.status,
    ...(input.detail !== undefined ? { detail: input.detail } : {}),
    ...(input.instance !== undefined ? { instance: input.instance } : {}),
    ...(input.extensions ?? {}),
  };
}

export function validationProblemFromZodError(error: ZodError, instance?: string): ProblemDetails {
  const detail = error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return createProblemDetails({
    slug: 'validation-error',
    title: 'Eingabevalidierung fehlgeschlagen',
    status: 422,
    detail,
    ...(instance !== undefined ? { instance } : {}),
  });
}

export function notFoundProblem(resource: string, instance?: string): ProblemDetails {
  return createProblemDetails({
    slug: 'not-found',
    title: `${resource} nicht gefunden`,
    status: 404,
    ...(instance !== undefined ? { instance } : {}),
  });
}

export function conflictProblem(detail: string, instance?: string): ProblemDetails {
  return createProblemDetails({
    slug: 'conflict',
    title: 'Konflikt beim Verarbeiten der Anfrage',
    status: 409,
    detail,
    ...(instance !== undefined ? { instance } : {}),
  });
}

export function internalProblem(instance?: string): ProblemDetails {
  return createProblemDetails({
    slug: 'internal-error',
    title: 'Interner Serverfehler',
    status: 500,
    ...(instance !== undefined ? { instance } : {}),
  });
}

export class DomainError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.title);
    this.name = 'DomainError';
    this.problem = problem;
  }
}

export function notFoundError(resource: string, instance?: string): DomainError {
  return new DomainError(notFoundProblem(resource, instance));
}

export function conflictError(detail: string, instance?: string): DomainError {
  return new DomainError(conflictProblem(detail, instance));
}
