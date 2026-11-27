'use client';

import type { CloudFile } from '@cloud-hub/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { authClient } from '../lib/auth-client';
import {
  filterAndSortFiles,
  formatFileSize,
  formatModifiedAt,
  type FileSort,
} from './dashboard-utils';

type SupportedProvider = 'google-drive' | 'dropbox';
type ProviderFilter = 'all' | SupportedProvider;

interface CloudConnection {
  readonly id: string;
  readonly provider: SupportedProvider;
  readonly accountEmail: string | null;
  readonly accountName: string | null;
  readonly status: string;
}

interface Breadcrumb {
  readonly name: string;
  readonly remoteId: string;
}

type TransferStatus = 'queued' | 'running' | 'retrying' | 'succeeded' | 'failed' | 'cancelled';

interface CloudTransfer {
  readonly id: string;
  readonly sourceConnectionId: string;
  readonly sourceName: string;
  readonly destinationConnectionId: string;
  readonly destinationName: string;
  readonly status: TransferStatus;
  readonly progressBytes: string;
  readonly sourceSizeBytes: string | null;
  readonly errorCode: string | null;
}

const providerNames: Record<SupportedProvider, string> = {
  'google-drive': 'Google Drive',
  dropbox: 'Dropbox',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function parseConnection(value: unknown): CloudConnection | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  if (value.provider !== 'google-drive' && value.provider !== 'dropbox') {
    return null;
  }

  return {
    id: value.id,
    provider: value.provider,
    accountEmail: typeof value.accountEmail === 'string' ? value.accountEmail : null,
    accountName: typeof value.accountName === 'string' ? value.accountName : null,
    status: typeof value.status === 'string' ? value.status : 'unknown',
  };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFile(value: unknown): CloudFile | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.remoteId !== 'string' ||
    typeof value.connectionId !== 'string' ||
    typeof value.name !== 'string' ||
    (value.provider !== 'google-drive' && value.provider !== 'dropbox') ||
    (value.kind !== 'file' && value.kind !== 'folder')
  ) {
    return null;
  }

  return {
    remoteId: value.remoteId,
    connectionId: value.connectionId,
    provider: value.provider,
    name: value.name,
    kind: value.kind,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : null,
    sizeBytes: typeof value.sizeBytes === 'number' && value.sizeBytes >= 0 ? value.sizeBytes : null,
    createdAt: parseDate(value.createdAt),
    modifiedAt: parseDate(value.modifiedAt),
    parentRemoteId: typeof value.parentRemoteId === 'string' ? value.parentRemoteId : null,
    webUrl:
      typeof value.webUrl === 'string' && value.webUrl.startsWith('https://') ? value.webUrl : null,
    providerMetadata: {},
  };
}

function parseTransfer(value: unknown): CloudTransfer | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.sourceConnectionId !== 'string' ||
    typeof value.sourceName !== 'string' ||
    typeof value.destinationConnectionId !== 'string' ||
    typeof value.destinationName !== 'string' ||
    typeof value.progressBytes !== 'string' ||
    (typeof value.sourceSizeBytes !== 'string' && value.sourceSizeBytes !== null) ||
    (typeof value.errorCode !== 'string' && value.errorCode !== null) ||
    !['queued', 'running', 'retrying', 'succeeded', 'failed', 'cancelled'].includes(
      String(value.status),
    )
  ) {
    return null;
  }

  return {
    id: value.id,
    sourceConnectionId: value.sourceConnectionId,
    sourceName: value.sourceName,
    destinationConnectionId: value.destinationConnectionId,
    destinationName: value.destinationName,
    status: value.status as TransferStatus,
    progressBytes: value.progressBytes,
    sourceSizeBytes: value.sourceSizeBytes,
    errorCode: value.errorCode,
  };
}

function requestErrorMessage(response: Response): string {
  if (response.status === 401) {
    return 'Sua sessão expirou ou esta conexão precisa ser refeita.';
  }

  if (response.status === 409) {
    return 'Reconecte as duas contas para autorizar a transferÃªncia de arquivos.';
  }

  return 'Não foi possível carregar os dados. Tente novamente.';
}

export function Dashboard({ userEmail }: { readonly userEmail: string }) {
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [connectionError, setConnectionError] = useState<string>();
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>();
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filesError, setFilesError] = useState<string>();
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allFilesWarning, setAllFilesWarning] = useState<string>();
  const [connectingProvider, setConnectingProvider] = useState<SupportedProvider>();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<FileSort>('name');
  const [notice, setNotice] = useState<string>();
  const [transfers, setTransfers] = useState<CloudTransfer[]>([]);
  const [transfersError, setTransfersError] = useState<string>();
  const [transferSource, setTransferSource] = useState<CloudFile>();
  const [transferDestinationId, setTransferDestinationId] = useState<string>();
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  const activeConnections = useMemo(
    () => connections.filter((connection) => connection.status === 'active'),
    [connections],
  );
  const visibleConnections = useMemo(
    () =>
      connections.filter(
        (connection) => providerFilter === 'all' || connection.provider === providerFilter,
      ),
    [connections, providerFilter],
  );
  const selectedConnection = activeConnections.find(
    (connection) => connection.id === selectedConnectionId,
  );
  const isAllConnectionsView = providerFilter === 'all' && !selectedConnectionId;
  const parentRemoteId = breadcrumbs.at(-1)?.remoteId ?? null;
  const displayedFiles = useMemo(
    () => filterAndSortFiles(files, search, sort),
    [files, search, sort],
  );
  const isTransferInProgress = transfers.some(
    (transfer) =>
      transfer.status === 'queued' ||
      transfer.status === 'running' ||
      transfer.status === 'retrying',
  );

  const loadConnections = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingConnections(true);
    setConnectionError(undefined);

    try {
      const response = await fetch('/api/cloud-connections', {
        credentials: 'same-origin',
        signal,
      });

      if (!response.ok) {
        throw new Error(requestErrorMessage(response));
      }

      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('A resposta de conexões não foi reconhecida.');
      }

      setConnections(
        payload
          .map(parseConnection)
          .filter((connection): connection is CloudConnection => Boolean(connection)),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setConnectionError(
        error instanceof Error ? error.message : 'Não foi possível carregar conexões.',
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoadingConnections(false);
      }
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    try {
      const response = await fetch('/api/transfers', { credentials: 'same-origin' });
      if (!response.ok) {
        throw new Error(requestErrorMessage(response));
      }
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('A resposta de transferÃªncias nÃ£o foi reconhecida.');
      }
      setTransfers(
        payload
          .map(parseTransfer)
          .filter((transfer): transfer is CloudTransfer => Boolean(transfer)),
      );
      setTransfersError(undefined);
    } catch (error) {
      setTransfersError(
        error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel carregar as transferÃªncias.',
      );
    }
  }, []);

  const loadFiles = useCallback(
    async (options: { readonly cursor: string | null; readonly append: boolean }) => {
      if (!selectedConnection) {
        return;
      }

      if (options.append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingFiles(true);
      }
      setFilesError(undefined);
      setAllFilesWarning(undefined);

      try {
        const parameters = new URLSearchParams({ pageSize: '50' });
        if (parentRemoteId) {
          parameters.set('parentRemoteId', parentRemoteId);
        }
        if (options.cursor) {
          parameters.set('cursor', options.cursor);
        }

        const response = await fetch(
          `/api/cloud-connections/${encodeURIComponent(selectedConnection.id)}/files?${parameters.toString()}`,
          { credentials: 'same-origin' },
        );
        if (!response.ok) {
          throw new Error(requestErrorMessage(response));
        }

        const payload: unknown = await response.json();
        if (!isRecord(payload) || !Array.isArray(payload.items)) {
          throw new Error('A resposta de arquivos não foi reconhecida.');
        }

        const page = payload.items
          .map(parseFile)
          .filter((file): file is CloudFile => Boolean(file));
        setFiles((currentFiles) => (options.append ? [...currentFiles, ...page] : page));
        setNextCursor(typeof payload.nextCursor === 'string' ? payload.nextCursor : null);
      } catch (error) {
        setFilesError(
          error instanceof Error ? error.message : 'Não foi possível carregar os arquivos.',
        );
      } finally {
        if (options.append) {
          setIsLoadingMore(false);
        } else {
          setIsLoadingFiles(false);
        }
      }
    },
    [parentRemoteId, selectedConnection],
  );

  const loadAllFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    setFilesError(undefined);
    setAllFilesWarning(undefined);
    setNextCursor(null);

    const results = await Promise.allSettled(
      activeConnections.map(async (connection) => {
        const parameters = new URLSearchParams({ pageSize: '50' });
        const response = await fetch(
          `/api/cloud-connections/${encodeURIComponent(connection.id)}/files?${parameters.toString()}`,
          { credentials: 'same-origin' },
        );

        if (!response.ok) {
          throw new Error(requestErrorMessage(response));
        }

        const payload: unknown = await response.json();
        if (!isRecord(payload) || !Array.isArray(payload.items)) {
          throw new Error('A resposta de arquivos não foi reconhecida.');
        }

        return payload.items.map(parseFile).filter((file): file is CloudFile => Boolean(file));
      }),
    );

    const loadedFiles = results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    );
    const failures = results.filter((result) => result.status === 'rejected').length;

    setFiles(loadedFiles);
    if (failures === activeConnections.length && failures > 0) {
      setFilesError('Não foi possível carregar os arquivos das conexões ativas.');
    } else if (failures > 0) {
      setAllFilesWarning(
        'Algumas conexões não puderam ser carregadas. Reconecte a conta indicada se necessário.',
      );
    }
    setIsLoadingFiles(false);
  }, [activeConnections]);

  async function connectProvider(provider: SupportedProvider) {
    setConnectingProvider(provider);
    setNotice(undefined);

    try {
      const response = await fetch(`/api/cloud-connections/${provider}/connect`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const payload: unknown = await response.json();

      if (
        !response.ok ||
        !isRecord(payload) ||
        typeof payload.authorizationUrl !== 'string' ||
        !payload.authorizationUrl.startsWith('https://')
      ) {
        throw new Error(`Não foi possível iniciar a conexão com ${providerNames[provider]}.`);
      }

      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : `Não foi possível conectar ${providerNames[provider]}.`,
      );
      setConnectingProvider(undefined);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void loadConnections(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadConnections]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadTransfers(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadTransfers]);

  useEffect(() => {
    if (!isTransferInProgress) {
      return;
    }

    const intervalId = window.setInterval(() => void loadTransfers(), 3_000);
    return () => window.clearInterval(intervalId);
  }, [isTransferInProgress, loadTransfers]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('googleDrive') === 'connected' || query.get('dropbox') === 'connected') {
      const timeoutId = window.setTimeout(() => {
        setNotice('Conta conectada com sucesso. Atualizamos suas conexões.');
        window.history.replaceState({}, '', window.location.pathname);
        void loadConnections();
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [loadConnections]);

  useEffect(() => {
    if (isAllConnectionsView && activeConnections.length > 0) {
      const timeoutId = window.setTimeout(() => void loadAllFiles(), 0);
      return () => window.clearTimeout(timeoutId);
    }

    if (selectedConnection) {
      const timeoutId = window.setTimeout(() => void loadFiles({ cursor: null, append: false }), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [activeConnections.length, isAllConnectionsView, loadAllFiles, loadFiles, selectedConnection]);

  function selectConnection(connectionId: string) {
    const connection = activeConnections.find((candidate) => candidate.id === connectionId);
    if (!connection) {
      return;
    }

    setProviderFilter(connection.provider);
    setSelectedConnectionId(connectionId);
    setBreadcrumbs([]);
    setSearch('');
    setFiles([]);
    setNextCursor(null);
    setAllFilesWarning(undefined);
  }

  function selectProviderFilter(provider: ProviderFilter) {
    setProviderFilter(provider);
    setSelectedConnectionId(
      provider === 'all'
        ? undefined
        : activeConnections.find((connection) => connection.provider === provider)?.id,
    );
    setBreadcrumbs([]);
    setSearch('');
    setFiles([]);
    setNextCursor(null);
    setAllFilesWarning(undefined);
  }

  function openFolder(file: CloudFile) {
    const connection = activeConnections.find((candidate) => candidate.id === file.connectionId);
    if (!connection) {
      return;
    }

    setProviderFilter(connection.provider);
    setSelectedConnectionId(connection.id);
    setBreadcrumbs([{ name: file.name, remoteId: file.remoteId }]);
    setSearch('');
    setFiles([]);
    setNextCursor(null);
    setAllFilesWarning(undefined);
  }

  function navigateToBreadcrumb(index: number) {
    setBreadcrumbs((current) => current.slice(0, index + 1));
    setSearch('');
    setFiles([]);
    setNextCursor(null);
    setAllFilesWarning(undefined);
  }

  function navigateToRoot() {
    setBreadcrumbs([]);
    setSearch('');
    setFiles([]);
    setNextCursor(null);
    setAllFilesWarning(undefined);
  }

  function startTransfer(file: CloudFile) {
    setTransferSource(file);
    setTransferDestinationId(
      activeConnections.find((connection) => connection.id !== file.connectionId)?.id ??
        activeConnections[0]?.id,
    );
    setTransfersError(undefined);
  }

  async function submitTransfer() {
    if (!transferSource || !transferDestinationId) {
      return;
    }

    setIsSubmittingTransfer(true);
    setTransfersError(undefined);
    try {
      const response = await fetch('/api/transfers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceConnectionId: transferSource.connectionId,
          sourceRemoteId: transferSource.remoteId,
          sourceName: transferSource.name,
          sourceMimeType: transferSource.mimeType,
          sourceSizeBytes: transferSource.sizeBytes,
          destinationConnectionId: transferDestinationId,
          destinationName: transferSource.name,
        }),
      });
      if (!response.ok) {
        throw new Error(requestErrorMessage(response));
      }

      setTransferSource(undefined);
      setNotice(
        'TransferÃªncia adicionada Ã  fila. O arquivo Ã© enviado diretamente entre os provedores.',
      );
      await loadTransfers();
    } catch (error) {
      setTransfersError(
        error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel criar a transferÃªncia.',
      );
    } finally {
      setIsSubmittingTransfer(false);
    }
  }

  async function cancelTransfer(transferId: string) {
    try {
      const response = await fetch(`/api/transfers/${encodeURIComponent(transferId)}/cancel`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        throw new Error(requestErrorMessage(response));
      }
      await loadTransfers();
    } catch (error) {
      setTransfersError(
        error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel cancelar a transferÃªncia.',
      );
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6 sm:p-10">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-700">Cloud Hub</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Seus arquivos em um só lugar</h1>
          <p className="mt-2 text-sm text-slate-600">Sessão ativa: {userEmail}</p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          onClick={() => void authClient.signOut()}
          type="button"
        >
          Sair
        </button>
      </header>

      <section aria-labelledby="connections-heading" className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold" id="connections-heading">
              Conexões
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Escolha uma conta para navegar pelos arquivos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['google-drive', 'dropbox'] as const).map((provider) => (
              <button
                className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={Boolean(connectingProvider)}
                key={provider}
                onClick={() => void connectProvider(provider)}
                type="button"
              >
                {connectingProvider === provider
                  ? 'Redirecionando…'
                  : `Conectar ${providerNames[provider]}`}
              </button>
            ))}
          </div>
        </div>

        {notice ? (
          <p className="mt-4 rounded-md bg-sky-50 p-3 text-sm text-sky-900">{notice}</p>
        ) : null}
        {connectionError ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{connectionError}</p>
        ) : null}

        <div
          className="mt-4 flex flex-wrap gap-2"
          role="group"
          aria-label="Filtrar conexões por provedor"
        >
          {(
            [
              ['all', 'Todas'],
              ['google-drive', 'Google Drive'],
              ['dropbox', 'Dropbox'],
            ] as const
          ).map(([provider, label]) => (
            <button
              aria-pressed={providerFilter === provider}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                providerFilter === provider
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
              key={provider}
              onClick={() => selectProviderFilter(provider)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {isLoadingConnections ? (
          <p className="mt-4 text-sm text-slate-600">Carregando conexões…</p>
        ) : null}
        {!isLoadingConnections && visibleConnections.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">
            Nenhuma conexão neste filtro. Conecte uma conta Google Drive ou Dropbox para começar.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {visibleConnections.map((connection) => (
            <button
              aria-pressed={selectedConnectionId === connection.id}
              className={`rounded-lg border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                selectedConnectionId === connection.id
                  ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-600'
                  : 'border-slate-200 bg-white hover:border-slate-400'
              }`}
              disabled={connection.status !== 'active'}
              key={connection.id}
              onClick={() => selectConnection(connection.id)}
              type="button"
            >
              <span className="block text-sm font-semibold text-sky-800">
                {providerNames[connection.provider]}
              </span>
              <span className="mt-1 block font-medium">
                {connection.accountName ?? connection.accountEmail ?? 'Conta conectada'}
              </span>
              {connection.accountName && connection.accountEmail ? (
                <span className="mt-1 block text-sm text-slate-600">{connection.accountEmail}</span>
              ) : null}
              <span className="mt-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                {connection.status === 'active' ? 'Ativa' : `Status: ${connection.status}`}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="files-heading" className="mt-10">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold" id="files-heading">
              Arquivos
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {isAllConnectionsView
                ? 'Raiz combinada de Google Drive e Dropbox. A busca considera somente os itens já carregados.'
                : selectedConnection
                  ? `Origem: ${providerNames[selectedConnection.provider]}. A busca considera somente os itens já carregados.`
                  : 'Selecione uma conexão para ver os arquivos.'}
            </p>
          </div>
          {selectedConnection || isAllConnectionsView ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="Buscar nos itens carregados"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nesta página"
                value={search}
              />
              <select
                aria-label="Ordenar arquivos"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setSort(event.target.value as FileSort)}
                value={sort}
              >
                <option value="name">Nome</option>
                <option value="modified-desc">Modificação mais recente</option>
              </select>
            </div>
          ) : null}
        </div>

        {selectedConnection ? (
          <nav
            aria-label="Caminho da pasta"
            className="mt-4 flex flex-wrap items-center gap-1 text-sm"
          >
            <button
              className="font-medium text-sky-700 hover:underline"
              onClick={navigateToRoot}
              type="button"
            >
              Raiz
            </button>
            {breadcrumbs.map((breadcrumb, index) => (
              <span className="flex items-center gap-1" key={breadcrumb.remoteId}>
                <span className="text-slate-400">/</span>
                <button
                  className="font-medium text-sky-700 hover:underline"
                  onClick={() => navigateToBreadcrumb(index)}
                  type="button"
                >
                  {breadcrumb.name}
                </button>
              </span>
            ))}
          </nav>
        ) : null}

        {filesError ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{filesError}</p>
        ) : null}
        {allFilesWarning ? (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            {allFilesWarning}
          </p>
        ) : null}
        {isLoadingFiles ? (
          <p className="mt-4 text-sm text-slate-600">Carregando arquivos…</p>
        ) : null}
        {(selectedConnection || isAllConnectionsView) &&
        !isLoadingFiles &&
        !filesError &&
        displayedFiles.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">
            {files.length === 0
              ? isAllConnectionsView
                ? 'Nenhuma conexão ativa possui itens na raiz.'
                : 'Esta pasta está vazia.'
              : 'Nenhum item corresponde à busca.'}
          </p>
        ) : null}

        {displayedFiles.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Tamanho</th>
                  <th className="px-4 py-3 font-semibold">Modificado</th>
                  <th className="px-4 py-3 font-semibold">Origem</th>
                  <th className="px-4 py-3 font-semibold">AÃ§Ãµes</th>
                </tr>
              </thead>
              <tbody>
                {displayedFiles.map((file) => (
                  <tr
                    className="border-t border-slate-100"
                    key={`${file.connectionId}:${file.remoteId}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {file.kind === 'folder' ? (
                        <button
                          className="text-sky-700 hover:underline"
                          onClick={() => openFolder(file)}
                          type="button"
                        >
                          📁 {file.name}
                        </button>
                      ) : file.webUrl ? (
                        <a
                          className="text-sky-700 hover:underline"
                          href={file.webUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {file.name}
                        </a>
                      ) : (
                        file.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {file.kind === 'folder' ? 'Pasta' : 'Arquivo'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatFileSize(file.sizeBytes)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatModifiedAt(file.modifiedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {providerNames[file.provider as SupportedProvider]}
                    </td>
                    <td className="px-4 py-3">
                      {file.kind === 'file' ? (
                        <button
                          className="rounded border border-sky-700 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-50"
                          onClick={() => startTransfer(file)}
                          type="button"
                        >
                          Transferir
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {nextCursor && !isAllConnectionsView ? (
          <button
            className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
            disabled={isLoadingMore}
            onClick={() => void loadFiles({ cursor: nextCursor, append: true })}
            type="button"
          >
            {isLoadingMore ? 'Carregando mais…' : 'Carregar mais'}
          </button>
        ) : null}
      </section>

      <section aria-labelledby="transfers-heading" className="mt-10 border-t border-slate-200 pt-8">
        <h2 className="text-xl font-semibold" id="transfers-heading">
          TransferÃªncias
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          A fila executa uma transferÃªncia por vez e nÃ£o guarda o conteÃºdo do arquivo no Cloud
          Hub.
        </p>
        {transfersError ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{transfersError}</p>
        ) : null}
        {transferSource ? (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
            <h3 className="font-semibold">Transferir {transferSource.name}</h3>
            <label className="mt-3 block text-sm font-medium" htmlFor="transfer-destination">
              Conta de destino (pasta raiz)
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-md"
              id="transfer-destination"
              onChange={(event) => setTransferDestinationId(event.target.value)}
              value={transferDestinationId ?? ''}
            >
              {activeConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {providerNames[connection.provider]} â€”{' '}
                  {connection.accountName ?? connection.accountEmail ?? 'Conta'}
                </option>
              ))}
            </select>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={!transferDestinationId || isSubmittingTransfer}
                onClick={() => void submitTransfer()}
                type="button"
              >
                {isSubmittingTransfer ? 'Adicionandoâ€¦' : 'Adicionar Ã  fila'}
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
                disabled={isSubmittingTransfer}
                onClick={() => setTransferSource(undefined)}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
        {transfers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Nenhuma transferÃªncia criada.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Arquivo</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Progresso</th>
                  <th className="px-4 py-3 font-semibold">AÃ§Ãµes</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer) => (
                  <tr className="border-t border-slate-100" key={transfer.id}>
                    <td className="px-4 py-3 font-medium">{transfer.sourceName}</td>
                    <td className="px-4 py-3 capitalize">{transfer.status}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatFileSize(Number(transfer.progressBytes))}
                      {transfer.sourceSizeBytes
                        ? ` de ${formatFileSize(Number(transfer.sourceSizeBytes))}`
                        : ''}
                      {transfer.errorCode ? ` (${transfer.errorCode})` : ''}
                    </td>
                    <td className="px-4 py-3">
                      {transfer.status === 'queued' || transfer.status === 'retrying' ? (
                        <button
                          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-50"
                          onClick={() => void cancelTransfer(transfer.id)}
                          type="button"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
