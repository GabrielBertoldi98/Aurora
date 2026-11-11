import {
  type ListFilesInput,
  type ListFilesResult,
  listFilesInputSchema,
} from '@cloud-hub/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { ProviderAdapterRegistry } from './provider-adapter-registry.service.js';

@Injectable()
export class ProvidersService {
  constructor(
    @Inject(ProviderAdapterRegistry) private readonly registry: ProviderAdapterRegistry,
  ) {}

  async listFiles(input: ListFilesInput): Promise<ListFilesResult> {
    const validatedInput = listFilesInputSchema.parse(input);
    const adapter = this.registry.getAdapter(validatedInput.connection.provider);

    if (!adapter.capabilities.canListFiles) {
      throw new Error(`The "${adapter.provider}" adapter does not support file listing.`);
    }

    return adapter.listFiles(validatedInput);
  }
}
