import { z } from 'zod';

export * from './cloud/adapter.js';
export * from './cloud/file.js';
export * from './cloud/provider.js';

export const healthResponseSchema = z.object({
  service: z.literal('api'),
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
