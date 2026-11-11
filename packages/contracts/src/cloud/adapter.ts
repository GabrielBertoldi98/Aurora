import { z } from 'zod';

import { cloudFileSchema } from './file.js';
import { cloudProviderCapabilitiesSchema, cloudProviderSchema } from './provider.js';

export const providerConnectionContextSchema = z.object({
  connectionId: z.string().min(1),
  userId: z.string().min(1),
  provider: cloudProviderSchema,
});

export const listFilesInputSchema = z.object({
  connection: providerConnectionContextSchema,
  parentRemoteId: z.string().min(1).nullable().optional(),
  cursor: z.string().min(1).nullable().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export const listFilesResultSchema = z.object({
  items: z.array(cloudFileSchema),
  nextCursor: z.string().nullable(),
});

export const cloudProviderErrorCodeSchema = z.enum([
  'authentication-expired',
  'rate-limited',
  'provider-unavailable',
  'operation-not-supported',
]);

export interface CloudProviderAdapter {
  readonly provider: z.infer<typeof cloudProviderSchema>;
  readonly capabilities: z.infer<typeof cloudProviderCapabilitiesSchema>;
  listFiles(
    input: z.infer<typeof listFilesInputSchema>,
  ): Promise<z.infer<typeof listFilesResultSchema>>;
}

export type ProviderConnectionContext = z.infer<typeof providerConnectionContextSchema>;
export type ListFilesInput = z.infer<typeof listFilesInputSchema>;
export type ListFilesResult = z.infer<typeof listFilesResultSchema>;
export type CloudProviderErrorCode = z.infer<typeof cloudProviderErrorCodeSchema>;
