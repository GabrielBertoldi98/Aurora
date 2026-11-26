import { describe, expect, it } from 'vitest';

import { filterAndSortFiles, formatFileSize } from './dashboard-utils';

describe('dashboard utilities', () => {
  const files = [
    {
      remoteId: 'file-1',
      connectionId: 'connection-1',
      provider: 'google-drive' as const,
      name: 'zebra.txt',
      kind: 'file' as const,
      mimeType: 'text/plain',
      sizeBytes: 10,
      createdAt: null,
      modifiedAt: new Date('2026-11-20T10:00:00Z'),
      parentRemoteId: null,
      webUrl: null,
      providerMetadata: {},
    },
    {
      remoteId: 'folder-1',
      connectionId: 'connection-1',
      provider: 'google-drive' as const,
      name: 'Arquivos',
      kind: 'folder' as const,
      mimeType: null,
      sizeBytes: null,
      createdAt: null,
      modifiedAt: new Date('2026-11-18T10:00:00Z'),
      parentRemoteId: null,
      webUrl: null,
      providerMetadata: {},
    },
  ];

  it('filters the loaded page and keeps folders before files', () => {
    expect(filterAndSortFiles(files, '', 'name').map((file) => file.name)).toEqual([
      'Arquivos',
      'zebra.txt',
    ]);
    expect(filterAndSortFiles(files, 'ZEBRA', 'name').map((file) => file.remoteId)).toEqual([
      'file-1',
    ]);
  });

  it('formats file sizes without exposing provider metadata', () => {
    expect(formatFileSize(null)).toBe('—');
    expect(formatFileSize(1536)).toBe('1,5 KB');
  });
});
