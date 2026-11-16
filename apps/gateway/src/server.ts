import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';

import { loadConfig, type AppConfig } from './config.js';
import { configureUndiciAgent } from './undici-agent.js';
import { ProviderRegistry } from '@ai-gateway/core';
import { GroqAdapter } from '@ai-gateway/provider-groq';
import { NvidiaAdapter } from '@ai-gateway/provider-nvidia';
import { GoogleAdapter } from '@ai-gateway/provider-google';
import { ElevenLabsAdapter } from '@ai-gateway/provider-elevenlabs';
import { getDb, initializeSchema, type DbClient } from '@ai-gateway/db';
import { RoutingCache } from './cache/routing-cache.js';
import { TelemetryQueue } from './telemetry/log-queue.js';

import { healthRoutes } from './routes/health.js';
import { v1ModelsRoutes } from './routes/v1/models.js';
import { v1ChatRoutes } from './routes/v1/chat.js';
import { v1AudioRoutes } from './routes/v1/audio.js';
import { v1EmbeddingsRoutes } from './routes/v1/embeddings.js';
import { v1ImagesRoutes } from './routes/v1/images.js';
import { v1ModerationsRoutes } from './routes/v1/moderations.js';
import { v1FilesRoutes } from './routes/v1/files.js';
import { v1UploadsRoutes } from './routes/v1/uploads.js';
import { StorageService } from './services/storage.js';
import { adminAuthRoutes } from './routes/admin/auth.js';
import { adminProvidersRoutes } from './routes/admin/providers.js';
import { adminModelsRoutes } from './routes/admin/models.js';
import { adminGatewayKeysRoutes } from './routes/admin/gateway-keys.js';
import { adminLogsRoutes } from './routes/admin/logs.js';

declare module 'fastify' {
  interface FastifyInstance {
    appConfig: AppConfig;
    db: DbClient | null;
    routingCache: RoutingCache;
    telemetryQueue: TelemetryQueue;
    providerRegistry: ProviderRegistry;
    storageService: StorageService;
  }
}

export interface BuildServerOptions {
  config?: Partial<AppConfig>;
  skipDbHydration?: boolean;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const config = { ...loadConfig(), ...options.config };

  // Setup connection pooling
  configureUndiciAgent();

  const app = fastify({
    logger: false,
    bodyLimit: 50 * 1024 * 1024, // 50MB for audio uploads
  });

  // Gracefully handle empty JSON bodies on POST/PUT
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    if (!body || body.trim() === '') {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Decorate configuration
  app.decorate('appConfig', config);

  // Setup Provider Registry & Register All Adapters
  const registry = new ProviderRegistry();
  registry.register(new GroqAdapter());
  registry.register(new NvidiaAdapter());
  registry.register(new GoogleAdapter());
  registry.register(new ElevenLabsAdapter());
  app.decorate('providerRegistry', registry);

  // Setup DB Client if connection string is configured
  let db: DbClient | null = null;
  if (config.databaseUrl && !options.skipDbHydration) {
    try {
      await initializeSchema(config.databaseUrl);
      db = getDb(config.databaseUrl);
    } catch (err) {
      console.error('[buildServer] Database connection/migration warning:', err);
    }
  }
  app.decorate('db', db);

  // Setup In-Memory Routing Cache, Telemetry Queue, and Storage Service
  const routingCache = new RoutingCache(db, config.masterSecret, registry);
  const telemetryQueue = new TelemetryQueue(db);
  const storageService = new StorageService(db);
  app.decorate('routingCache', routingCache);
  app.decorate('telemetryQueue', telemetryQueue);
  app.decorate('storageService', storageService);

  // Register Core Middleware
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(null, true); // Dev-friendly fallback
    },
    credentials: true,
  });

  await app.register(cookie, {
    secret: config.jwtSecret,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  // Register Operational & OpenAI Routes
  await app.register(healthRoutes);
  await app.register(v1ModelsRoutes);
  await app.register(v1ChatRoutes);
  await app.register(v1AudioRoutes);
  await app.register(v1EmbeddingsRoutes);
  await app.register(v1ImagesRoutes);
  await app.register(v1ModerationsRoutes);
  await app.register(v1FilesRoutes);
  await app.register(v1UploadsRoutes);

  // Register Admin Routes
  await app.register(adminAuthRoutes);
  await app.register(adminProvidersRoutes);
  await app.register(adminModelsRoutes);
  await app.register(adminGatewayKeysRoutes);
  await app.register(adminLogsRoutes);

  // Static Frontend Serving in Production if built apps/web/dist exists
  const webDistPath = path.resolve(process.cwd(), '../web/dist');
  const webDistPathAlt = path.resolve(process.cwd(), 'apps/web/dist');
  const staticRoot = fs.existsSync(webDistPath)
    ? webDistPath
    : fs.existsSync(webDistPathAlt)
      ? webDistPathAlt
      : null;

  if (staticRoot) {
    await app.register(fastifyStatic, {
      root: staticRoot,
      prefix: '/',
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/v1/') || request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: { message: 'Not found', type: 'invalid_request_error' } });
      }
      return reply.sendFile('index.html');
    });
  }

  // Hydrate cache on startup if DB is connected
  if (db && !options.skipDbHydration) {
    await routingCache.hydrate();
  }

  // Cleanup on close
  app.addHook('onClose', async () => {
    telemetryQueue.close();
  });

  return app;
}
