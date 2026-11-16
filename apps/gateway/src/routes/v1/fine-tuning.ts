import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError } from '@ai-gateway/core';

export interface OpenAIFineTuningJob {
  id: string;
  object: 'fine_tuning.job';
  created_at: number;
  model: string;
  fine_tuned_model?: string | null;
  organization_id?: string;
  status:
    | 'validating_files'
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'cancelled';
  training_file: string;
  validation_file?: string | null;
  result_files: string[];
  trained_tokens?: number | null;
  hyperparameters?: Record<string, unknown>;
  error?: unknown | null;
}

const memoryJobs = new Map<string, OpenAIFineTuningJob>();

export const v1FineTuningRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/fine_tuning/jobs (Create job)
  fastify.post<{
    Body: {
      model: string;
      training_file: string;
      validation_file?: string;
      hyperparameters?: Record<string, unknown>;
    };
  }>(
    '/v1/fine_tuning/jobs',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const body = request.body;
      if (!body || !body.model || !body.training_file) {
        return reply.status(400).send(
          createOpenAIError('Missing required parameters: model, training_file.', 400, 'invalid_request_error')
        );
      }

      const id = `ftjob-${crypto.randomBytes(12).toString('hex')}`;
      const now = Math.floor(Date.now() / 1000);

      const job: OpenAIFineTuningJob = {
        id,
        object: 'fine_tuning.job',
        created_at: now,
        model: body.model,
        fine_tuned_model: null,
        organization_id: 'org-default',
        status: 'validating_files',
        training_file: body.training_file,
        validation_file: body.validation_file || null,
        result_files: [],
        trained_tokens: null,
        hyperparameters: body.hyperparameters || { n_epochs: 'auto' },
        error: null,
      };

      memoryJobs.set(id, job);
      return reply.status(200).send(job);
    }
  );

  // GET /v1/fine_tuning/jobs (List jobs)
  fastify.get(
    '/v1/fine_tuning/jobs',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const list = Array.from(memoryJobs.values());
      return reply.status(200).send({
        object: 'list',
        data: list,
        has_more: false,
      });
    }
  );

  // GET /v1/fine_tuning/jobs/:id (Retrieve job)
  fastify.get<{ Params: { id: string } }>(
    '/v1/fine_tuning/jobs/:id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { id } = request.params;
      const job = memoryJobs.get(id);
      if (!job) {
        return reply.status(404).send(
          createOpenAIError(`No such fine-tuning job: '${id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(job);
    }
  );

  // POST /v1/fine_tuning/jobs/:id/cancel (Cancel job)
  fastify.post<{ Params: { id: string } }>(
    '/v1/fine_tuning/jobs/:id/cancel',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { id } = request.params;
      const job = memoryJobs.get(id);
      if (!job) {
        return reply.status(404).send(
          createOpenAIError(`No such fine-tuning job: '${id}'`, 404, 'invalid_request_error')
        );
      }

      job.status = 'cancelled';
      return reply.status(200).send(job);
    }
  );

  // GET /v1/fine_tuning/jobs/:id/events (List events)
  fastify.get<{ Params: { id: string } }>(
    '/v1/fine_tuning/jobs/:id/events',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { id } = request.params;
      const job = memoryJobs.get(id);
      if (!job) {
        return reply.status(404).send(
          createOpenAIError(`No such fine-tuning job: '${id}'`, 404, 'invalid_request_error')
        );
      }

      return reply.status(200).send({
        object: 'list',
        data: [
          {
            id: `ftevent-${crypto.randomBytes(8).toString('hex')}`,
            object: 'fine_tuning.job.event',
            created_at: job.created_at,
            level: 'info',
            message: 'Files validated successfully.',
            data: null,
            type: 'message',
          },
        ],
        has_more: false,
      });
    }
  );
};
