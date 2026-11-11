import type {
  CloudFile,
  CloudProvider,
  CloudProviderAdapter,
  CloudProviderCapabilities,
  ListFilesInput,
  ListFilesResult,
} from '@cloud-hub/contracts';
import { Injectable } from '@nestjs/common';

abstract class FakeProviderAdapter implements CloudProviderAdapter {
  abstract readonly provider: CloudProvider;
  abstract readonly capabilities: CloudProviderCapabilities;

  async listFiles(input: ListFilesInput): Promise<ListFilesResult> {
    const parentRemoteId = input.parentRemoteId ?? null;
    const items = this.getFiles(input.connection.connectionId).filter(
      (file) => file.parentRemoteId === parentRemoteId,
    );

    return {
      items: items.slice(0, input.pageSize ?? 100),
      nextCursor: null,
    };
  }

  protected getFiles(connectionId: string): readonly CloudFile[] {
    const folderId = `${this.provider}-folder`;

    return [
      {
        remoteId: folderId,
        connectionId,
        provider: this.provider,
        name: 'Documents',
        kind: 'folder',
        mimeType: null,
        sizeBytes: null,
        createdAt: null,
        modifiedAt: null,
        parentRemoteId: null,
        webUrl: null,
        providerMetadata: {},
      },
      {
        remoteId: `${this.provider}-file`,
        connectionId,
        provider: this.provider,
        name: 'welcome.txt',
        kind: 'file',
        mimeType: 'text/plain',
        sizeBytes: 16,
        createdAt: null,
        modifiedAt: null,
        parentRemoteId: folderId,
        webUrl: null,
        providerMetadata: {},
      },
    ];
  }
}

const listOnlyCapabilities = {
  canListFiles: true,
  canNavigateFolders: true,
  canSearch: false,
  canDownload: false,
} as const;

@Injectable()
export class GoogleDriveAdapter extends FakeProviderAdapter {
  readonly provider = 'google-drive' as const;
  readonly capabilities = listOnlyCapabilities;
}

@Injectable()
export class DropboxAdapter extends FakeProviderAdapter {
  readonly provider = 'dropbox' as const;
  readonly capabilities = listOnlyCapabilities;
}

@Injectable()
export class OneDriveAdapter extends FakeProviderAdapter {
  readonly provider = 'onedrive' as const;
  readonly capabilities = listOnlyCapabilities;
}
