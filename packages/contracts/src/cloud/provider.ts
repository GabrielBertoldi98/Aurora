import { z } from 'zod';

export const cloudProviderSchema = z.enum(['google-drive', 'dropbox', 'onedrive']);

export type CloudProvider = z.infer<typeof cloudProviderSchema>;

export const cloudProviderCapabilitiesSchema = z.object({
  canListFiles: z.boolean(),
  canNavigateFolders: z.boolean(),
  canSearch: z.boolean(),
  canDownload: z.boolean(),
});

export type CloudProviderCapabilities = z.infer<typeof cloudProviderCapabilitiesSchema>;
