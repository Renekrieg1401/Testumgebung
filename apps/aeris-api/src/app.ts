import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { openDatabase } from './db/database';
import { createSqliteVaultRepository } from './repositories/vault.repository';
import { createSqliteAssessmentRepository } from './repositories/assessment.repository';
import { registerErrorHandler } from './plugins/error-handler';
import { registerHealthRoute } from './routes/health.route';
import { registerVaultRoutes } from './routes/vault.route';
import { registerAssessmentRoutes } from './routes/assessments.route';

export interface BuildAppOptions {
  readonly databasePath: string;
  readonly logger?: boolean;
  readonly corsOrigins?: readonly string[];
}

const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:3400'];

/**
 * Baut die App über Dependency Injection auf: Repositories werden hier
 * einmalig erzeugt und in die Routen gereicht statt global als Singleton
 * referenziert — damit ist die App in Tests mit einer isolierten
 * In-Memory-Datenbank (":memory:") instanziierbar.
 */
export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });
  void app.register(cors, { origin: [...(options.corsOrigins ?? DEFAULT_CORS_ORIGINS)] });
  const db = openDatabase(options.databasePath);
  const vaultRepository = createSqliteVaultRepository(db);
  const assessmentRepository = createSqliteAssessmentRepository(db);

  registerErrorHandler(app);
  registerHealthRoute(app);
  registerVaultRoutes(app, vaultRepository);
  registerAssessmentRoutes(app, assessmentRepository);

  app.addHook('onClose', (_instance, done) => {
    db.close();
    done();
  });

  return app;
}
