import type { Readable } from 'node:stream';

export interface DownloadedCloudFile {
  readonly stream: Readable;
  readonly mimeType: string | null;
  readonly sizeBytes: bigint | null;
}

export interface UploadCloudFileInput {
  readonly connectionId: string;
  readonly userId: string;
  readonly parentRemoteId: string | null;
  readonly fileName: string;
  readonly mimeType: string | null;
  readonly sizeBytes: bigint | null;
  readonly stream: Readable;
}

export class ProviderTransferError extends Error {
  constructor(
    readonly code: 'authentication-required' | 'provider-unavailable' | 'transfer-not-supported',
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'ProviderTransferError';
  }
}
