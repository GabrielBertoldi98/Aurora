import { z } from 'zod';

import { cloudProviderSchema } from './provider.js';

export const cloudFileKindSchema = z.enum(['file', 'folder']);

export const cloudFileSchema = z.object({
  remoteId: z.string().min(1),
  connectionId: z.string().min(1),
  provider: cloudProviderSchema,
  name: z.string().min(1),
  kind: cloudFileKindSchema,
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  createdAt: z.coerce.date().nullable(),
  modifiedAt: z.coerce.date().nullable(),
  parentRemoteId: z.string().nullable(),
  webUrl: z.url().nullable(),
  providerMetadata: z.record(z.string(), z.unknown()),
});

export type CloudFile = z.infer<typeof cloudFileSchema>;
export type CloudFileKind = z.infer<typeof cloudFileKindSchema>;
