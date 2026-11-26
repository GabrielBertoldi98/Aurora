import type { CloudFile } from '@cloud-hub/contracts';

export type FileSort = 'name' | 'modified-desc';

export function filterAndSortFiles(
  files: readonly CloudFile[],
  search: string,
  sort: FileSort,
): CloudFile[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();

  return files
    .filter((file) => file.name.toLocaleLowerCase().includes(normalizedSearch))
    .toSorted((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'folder' ? -1 : 1;
      }

      if (sort === 'modified-desc') {
        const modificationDifference =
          (right.modifiedAt?.getTime() ?? 0) - (left.modifiedAt?.getTime() ?? 0);

        if (modificationDifference !== 0) {
          return modificationDifference;
        }
      }

      return left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' });
    });
}

export function formatFileSize(sizeBytes: number | null): string {
  if (sizeBytes === null) {
    return '—';
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(
    Math.floor(Math.log(sizeBytes) / Math.log(1024)) - 1,
    units.length - 1,
  );
  const value = sizeBytes / 1024 ** (unitIndex + 1);

  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
}

export function formatModifiedAt(value: Date | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}
