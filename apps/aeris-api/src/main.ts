import { buildApp } from './app';

const PORT = Number(process.env.PORT ?? 3333);
const DATABASE_PATH = process.env.AERIS_DB_PATH ?? 'aeris-api.sqlite';
const corsOriginsEnv = process.env.AERIS_CORS_ORIGINS;
const CORS_ORIGINS = corsOriginsEnv?.split(',').map((origin) => origin.trim());

const app = buildApp({
  databasePath: DATABASE_PATH,
  ...(CORS_ORIGINS !== undefined ? { corsOrigins: CORS_ORIGINS } : {}),
});

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`AERIS API lauscht auf Port ${String(PORT)}`);
  })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
