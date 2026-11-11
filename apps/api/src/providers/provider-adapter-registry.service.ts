import type { CloudProvider, CloudProviderAdapter } from '@cloud-hub/contracts';
import { Inject, Injectable } from '@nestjs/common';

export const PROVIDER_ADAPTERS = Symbol('PROVIDER_ADAPTERS');

export class ProviderAdapterNotRegisteredError extends Error {
  constructor(provider: CloudProvider) {
    super(`No adapter is registered for provider "${provider}".`);
    this.name = 'ProviderAdapterNotRegisteredError';
  }
}

@Injectable()
export class ProviderAdapterRegistry {
  private readonly adaptersByProvider: ReadonlyMap<CloudProvider, CloudProviderAdapter>;

  constructor(@Inject(PROVIDER_ADAPTERS) adapters: readonly CloudProviderAdapter[]) {
    this.adaptersByProvider = new Map(adapters.map((adapter) => [adapter.provider, adapter]));
  }

  getAdapter(provider: CloudProvider): CloudProviderAdapter {
    const adapter = this.adaptersByProvider.get(provider);

    if (!adapter) {
      throw new ProviderAdapterNotRegisteredError(provider);
    }

    return adapter;
  }
}
