import { z } from 'zod';

export const transferStatusSchema = z.enum([
  'queued',
  'running',
  'retrying',
  'succeeded',
  'failed',
  'cancelled',
]);

export const createTransferSchema = z.object({
  sourceConnectionId: z.string().min(1).max(191),
  sourceRemoteId: z.string().min(1).max(1024),
  sourceName: z
    .string()
    .min(1)
    .max(255)
    .refine((name) => !/[\\/\0]/.test(name), {
      message: 'The destination file name must not contain a path.',
    }),
  sourceMimeType: z.string().min(1).max(255).nullable().optional(),
  sourceSizeBytes: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable()
    .optional(),
  destinationConnectionId: z.string().min(1).max(191),
  destinationParentRemoteId: z.string().min(1).max(1024).nullable().optional(),
  destinationName: z
    .string()
    .min(1)
    .max(255)
    .refine((name) => !/[\\/\0]/.test(name), {
      message: 'The destination file name must not contain a path.',
    }),
});

export const transferSummarySchema = z.object({
  id: z.string().min(1),
  sourceConnectionId: z.string().min(1),
  sourceRemoteId: z.string().min(1),
  sourceName: z.string().min(1),
  destinationConnectionId: z.string().min(1),
  destinationName: z.string().min(1),
  status: transferStatusSchema,
  progressBytes: z.string().regex(/^\d+$/),
  sourceSizeBytes: z.string().regex(/^\d+$/).nullable(),
  errorCode: z.string().nullable(),
  queuedAt: z.coerce.date(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
});

export type CreateTransfer = z.infer<typeof createTransferSchema>;
export type TransferStatus = z.infer<typeof transferStatusSchema>;
export type TransferSummary = z.infer<typeof transferSummarySchema>;
