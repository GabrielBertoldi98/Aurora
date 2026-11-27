import type { Transfer } from '../generated/prisma/client.js';
import { Inject, Injectable } from '@nestjs/common';
import { Transform } from 'node:stream';

import { DropboxAdapter } from '../providers/dropbox.adapter.js';
import { ProviderTransferError } from '../providers/file-transfer.js';
import { GoogleDriveAdapter } from '../providers/google-drive.adapter.js';

type ProgressCallback = (progressBytes: bigint) => void;
type TransferWithConnections = Transfer & {
  readonly sourceConnection: { readonly provider: string };
  readonly destinationConnection: { readonly provider: string };
};

@Injectable()
export class TransferContentService {
  constructor(
    @Inject(GoogleDriveAdapter) private readonly googleDrive: GoogleDriveAdapter,
    @Inject(DropboxAdapter) private readonly dropbox: DropboxAdapter,
  ) {}

  async transfer(transfer: TransferWithConnections, onProgress: ProgressCallback): Promise<void> {
    const source = this.getAdapter(transfer.sourceConnection.provider);
    const destination = this.getAdapter(transfer.destinationConnection.provider);
    const downloaded = await source.downloadFile({
      connectionId: transfer.sourceConnectionId,
      userId: transfer.userId,
      remoteId: transfer.sourceRemoteId,
    });
    let transferred = 0n;
    const progress = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        transferred += BigInt(chunk.length);
        onProgress(transferred);
        callback(null, chunk);
      },
    });

    downloaded.stream.on('error', (error) => progress.destroy(error));

    await destination.uploadFile({
      connectionId: transfer.destinationConnectionId,
      userId: transfer.userId,
      parentRemoteId: transfer.destinationParentRemoteId,
      fileName: transfer.destinationName,
      mimeType: transfer.sourceMimeType ?? downloaded.mimeType,
      sizeBytes: transfer.sourceSizeBytes ?? downloaded.sizeBytes,
      stream: downloaded.stream.pipe(progress),
    });
  }

  private getAdapter(provider: string): GoogleDriveAdapter | DropboxAdapter {
    if (provider === 'google-drive') {
      return this.googleDrive;
    }

    if (provider === 'dropbox') {
      return this.dropbox;
    }

    throw new ProviderTransferError('transfer-not-supported', false);
  }
}
