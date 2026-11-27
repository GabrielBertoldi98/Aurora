import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';

import { prisma } from '../database/prisma.js';
import { TokenEncryptionService } from './token-encryption.service.js';

const GOOGLE_DRIVE_PROVIDER = 'google-drive';
const DROPBOX_PROVIDER = 'dropbox';
const OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_THRESHOLD_MS = 60 * 1000;
const GOOGLE_DRIVE_SCOPES =
  'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
const DROPBOX_SCOPES =
  'account_info.read files.metadata.read files.content.read files.content.write';

const googleTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

const googleAboutResponseSchema = z.object({
  user: z.object({
    displayName: z.string().nullable().optional(),
    emailAddress: z.string().email().nullable().optional(),
    permissionId: z.string().min(1),
  }),
});

type GoogleTokenResponse = z.infer<typeof googleTokenResponseSchema>;

const dropboxAccountResponseSchema = z.object({
  account_id: z.string().min(1),
  email: z.string().email(),
  name: z.object({
    display_name: z.string().min(1),
  }),
});

type DropboxTokenResponse = GoogleTokenResponse;

@Injectable()
export class CloudConnectionsService {
  constructor(
    @Inject(TokenEncryptionService) private readonly encryption: TokenEncryptionService,
  ) {}

  async listForUser(userId: string) {
    return prisma.cloudConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        externalAccountId: true,
        accountEmail: true,
        accountName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getConnectionForUser(connectionId: string, userId: string) {
    const connection = await prisma.cloudConnection.findFirst({
      where: { id: connectionId, userId, status: 'active' },
      select: { id: true, provider: true },
    });

    if (!connection) {
      throw new UnauthorizedException('Cloud connection was not found.');
    }

    return connection;
  }

  async canTransferContent(connectionId: string, userId: string): Promise<boolean> {
    const credential = await prisma.cloudCredential.findFirst({
      where: {
        connectionId,
        connection: { userId, status: 'active' },
      },
      select: { scope: true, connection: { select: { provider: true } } },
    });

    if (!credential) {
      return false;
    }

    const scopes = new Set((credential.scope ?? '').split(/\s+/).filter(Boolean));
    if (credential.connection.provider === GOOGLE_DRIVE_PROVIDER) {
      return [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
      ].every((scope) => scopes.has(scope));
    }

    if (credential.connection.provider === DROPBOX_PROVIDER) {
      return ['files.content.read', 'files.content.write'].every((scope) => scopes.has(scope));
    }

    return false;
  }

  async beginGoogleDriveConnection(userId: string): Promise<{ authorizationUrl: string }> {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(48).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const config = this.getGoogleConfig();

    await prisma.oAuthTransaction.create({
      data: {
        userId,
        provider: GOOGLE_DRIVE_PROVIDER,
        stateHash: this.hashState(state),
        encryptedCodeVerifier: this.encryption.encrypt(codeVerifier),
        expiresAt: new Date(Date.now() + OAUTH_TRANSACTION_TTL_MS),
      },
    });

    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', GOOGLE_DRIVE_SCOPES);
    authorizationUrl.searchParams.set('access_type', 'offline');
    authorizationUrl.searchParams.set('prompt', 'consent');
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('state', state);

    return { authorizationUrl: authorizationUrl.toString() };
  }

  async beginDropboxConnection(userId: string): Promise<{ authorizationUrl: string }> {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(48).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const config = this.getDropboxConfig();

    await prisma.oAuthTransaction.create({
      data: {
        userId,
        provider: DROPBOX_PROVIDER,
        stateHash: this.hashState(state),
        encryptedCodeVerifier: this.encryption.encrypt(codeVerifier),
        expiresAt: new Date(Date.now() + OAUTH_TRANSACTION_TTL_MS),
      },
    });

    const authorizationUrl = new URL('https://www.dropbox.com/oauth2/authorize');
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('token_access_type', 'offline');
    authorizationUrl.searchParams.set('scope', DROPBOX_SCOPES);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('state', state);

    return { authorizationUrl: authorizationUrl.toString() };
  }

  async completeGoogleDriveConnection(code: string, state: string) {
    const transaction = await prisma.oAuthTransaction.findFirst({
      where: {
        provider: GOOGLE_DRIVE_PROVIDER,
        stateHash: this.hashState(state),
        expiresAt: { gt: new Date() },
      },
    });

    if (!transaction) {
      throw new UnauthorizedException('OAuth state is invalid or expired.');
    }

    await prisma.oAuthTransaction.delete({ where: { id: transaction.id } });

    const config = this.getGoogleConfig();
    const tokens = await this.exchangeAuthorizationCode(
      code,
      this.encryption.decrypt(transaction.encryptedCodeVerifier),
      config,
    );
    const account = await this.getGoogleAccount(tokens.access_token);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    return prisma.$transaction(async (database) => {
      const connection = await database.cloudConnection.upsert({
        where: {
          userId_provider_externalAccountId: {
            userId: transaction.userId,
            provider: GOOGLE_DRIVE_PROVIDER,
            externalAccountId: account.permissionId,
          },
        },
        create: {
          userId: transaction.userId,
          provider: GOOGLE_DRIVE_PROVIDER,
          externalAccountId: account.permissionId,
          accountEmail: account.emailAddress ?? null,
          accountName: account.displayName ?? null,
        },
        update: {
          accountEmail: account.emailAddress ?? null,
          accountName: account.displayName ?? null,
          status: 'active',
        },
      });
      const existingCredential = await database.cloudCredential.findUnique({
        where: { connectionId: connection.id },
      });

      await database.cloudCredential.upsert({
        where: { connectionId: connection.id },
        create: {
          connectionId: connection.id,
          encryptedAccessToken: this.encryption.encrypt(tokens.access_token),
          encryptedRefreshToken: tokens.refresh_token
            ? this.encryption.encrypt(tokens.refresh_token)
            : null,
          accessTokenExpiresAt: expiresAt,
          scope: tokens.scope ?? null,
        },
        update: {
          encryptedAccessToken: this.encryption.encrypt(tokens.access_token),
          encryptedRefreshToken: tokens.refresh_token
            ? this.encryption.encrypt(tokens.refresh_token)
            : (existingCredential?.encryptedRefreshToken ?? null),
          accessTokenExpiresAt: expiresAt,
          scope: tokens.scope ?? null,
          keyVersion: 1,
        },
      });

      return connection;
    });
  }

  async completeDropboxConnection(code: string, state: string) {
    const transaction = await prisma.oAuthTransaction.findFirst({
      where: {
        provider: DROPBOX_PROVIDER,
        stateHash: this.hashState(state),
        expiresAt: { gt: new Date() },
      },
    });

    if (!transaction) {
      throw new UnauthorizedException('OAuth state is invalid or expired.');
    }

    await prisma.oAuthTransaction.delete({ where: { id: transaction.id } });

    const config = this.getDropboxConfig();
    const tokens = await this.exchangeDropboxAuthorizationCode(
      code,
      this.encryption.decrypt(transaction.encryptedCodeVerifier),
      config,
    );
    const account = await this.getDropboxAccount(tokens.access_token);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    return prisma.$transaction(async (database) => {
      const connection = await database.cloudConnection.upsert({
        where: {
          userId_provider_externalAccountId: {
            userId: transaction.userId,
            provider: DROPBOX_PROVIDER,
            externalAccountId: account.account_id,
          },
        },
        create: {
          userId: transaction.userId,
          provider: DROPBOX_PROVIDER,
          externalAccountId: account.account_id,
          accountEmail: account.email,
          accountName: account.name.display_name,
        },
        update: {
          accountEmail: account.email,
          accountName: account.name.display_name,
          status: 'active',
        },
      });
      const existingCredential = await database.cloudCredential.findUnique({
        where: { connectionId: connection.id },
      });

      await database.cloudCredential.upsert({
        where: { connectionId: connection.id },
        create: {
          connectionId: connection.id,
          encryptedAccessToken: this.encryption.encrypt(tokens.access_token),
          encryptedRefreshToken: tokens.refresh_token
            ? this.encryption.encrypt(tokens.refresh_token)
            : null,
          accessTokenExpiresAt: expiresAt,
          scope: tokens.scope ?? DROPBOX_SCOPES,
        },
        update: {
          encryptedAccessToken: this.encryption.encrypt(tokens.access_token),
          encryptedRefreshToken: tokens.refresh_token
            ? this.encryption.encrypt(tokens.refresh_token)
            : (existingCredential?.encryptedRefreshToken ?? null),
          accessTokenExpiresAt: expiresAt,
          scope: tokens.scope ?? existingCredential?.scope ?? DROPBOX_SCOPES,
          keyVersion: 1,
        },
      });

      return connection;
    });
  }

  async getGoogleDriveAccessToken(connectionId: string, userId: string): Promise<string> {
    const credential = await prisma.cloudCredential.findFirst({
      where: {
        connectionId,
        connection: {
          userId,
          provider: GOOGLE_DRIVE_PROVIDER,
          status: 'active',
        },
      },
    });

    if (!credential) {
      throw new UnauthorizedException('Google Drive connection was not found.');
    }

    if (
      !credential.accessTokenExpiresAt ||
      credential.accessTokenExpiresAt.getTime() > Date.now() + TOKEN_REFRESH_THRESHOLD_MS
    ) {
      return this.encryption.decrypt(credential.encryptedAccessToken);
    }

    if (!credential.encryptedRefreshToken) {
      throw new UnauthorizedException('Google Drive connection needs to be reconnected.');
    }

    const refreshedTokens = await this.refreshAccessToken(
      this.encryption.decrypt(credential.encryptedRefreshToken),
      this.getGoogleConfig(),
    );
    const expiresAt = refreshedTokens.expires_in
      ? new Date(Date.now() + refreshedTokens.expires_in * 1000)
      : null;

    await prisma.cloudCredential.update({
      where: { id: credential.id },
      data: {
        encryptedAccessToken: this.encryption.encrypt(refreshedTokens.access_token),
        accessTokenExpiresAt: expiresAt,
        scope: refreshedTokens.scope ?? credential.scope,
      },
    });

    return refreshedTokens.access_token;
  }

  async getDropboxAccessToken(connectionId: string, userId: string): Promise<string> {
    const credential = await prisma.cloudCredential.findFirst({
      where: {
        connectionId,
        connection: {
          userId,
          provider: DROPBOX_PROVIDER,
          status: 'active',
        },
      },
    });

    if (!credential) {
      throw new UnauthorizedException('Dropbox connection was not found.');
    }

    if (
      !credential.accessTokenExpiresAt ||
      credential.accessTokenExpiresAt.getTime() > Date.now() + TOKEN_REFRESH_THRESHOLD_MS
    ) {
      return this.encryption.decrypt(credential.encryptedAccessToken);
    }

    if (!credential.encryptedRefreshToken) {
      throw new UnauthorizedException('Dropbox connection needs to be reconnected.');
    }

    const refreshedTokens = await this.refreshDropboxAccessToken(
      this.encryption.decrypt(credential.encryptedRefreshToken),
      this.getDropboxConfig(),
    );
    const expiresAt = refreshedTokens.expires_in
      ? new Date(Date.now() + refreshedTokens.expires_in * 1000)
      : null;

    await prisma.cloudCredential.update({
      where: { id: credential.id },
      data: {
        encryptedAccessToken: this.encryption.encrypt(refreshedTokens.access_token),
        accessTokenExpiresAt: expiresAt,
        scope: refreshedTokens.scope ?? credential.scope,
      },
    });

    return refreshedTokens.access_token;
  }

  private async exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
    config: GoogleConfig,
  ): Promise<GoogleTokenResponse> {
    return this.requestGoogleToken({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });
  }

  private async refreshAccessToken(
    refreshToken: string,
    config: GoogleConfig,
  ): Promise<GoogleTokenResponse> {
    return this.requestGoogleToken({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  private async requestGoogleToken(values: Record<string, string>): Promise<GoogleTokenResponse> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Google OAuth token exchange failed.');
    }

    return googleTokenResponseSchema.parse(await response.json());
  }

  private async exchangeDropboxAuthorizationCode(
    code: string,
    codeVerifier: string,
    config: DropboxConfig,
  ): Promise<DropboxTokenResponse> {
    return this.requestDropboxToken({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });
  }

  private async refreshDropboxAccessToken(
    refreshToken: string,
    config: DropboxConfig,
  ): Promise<DropboxTokenResponse> {
    return this.requestDropboxToken({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  private async requestDropboxToken(values: Record<string, string>): Promise<DropboxTokenResponse> {
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Dropbox OAuth token exchange failed.');
    }

    return googleTokenResponseSchema.parse(await response.json());
  }

  private async getGoogleAccount(accessToken: string) {
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,permissionId)',
      { headers: { authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Google Drive account could not be identified.');
    }

    return googleAboutResponseSchema.parse(await response.json()).user;
  }

  private async getDropboxAccount(accessToken: string) {
    const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Dropbox account could not be identified.');
    }

    return dropboxAccountResponseSchema.parse(await response.json());
  }

  private hashState(state: string): string {
    return createHash('sha256').update(state).digest('base64url');
  }

  private getGoogleConfig(): GoogleConfig {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const apiPublicUrl = process.env.API_PUBLIC_URL;

    if (
      !clientId ||
      !clientSecret ||
      !apiPublicUrl ||
      clientId.startsWith('example-') ||
      clientSecret.startsWith('example-')
    ) {
      throw new Error('Google OAuth configuration is incomplete.');
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${apiPublicUrl}/cloud-connections/google-drive/callback`,
    };
  }

  private getDropboxConfig(): DropboxConfig {
    const clientId = process.env.DROPBOX_CLIENT_ID;
    const clientSecret = process.env.DROPBOX_CLIENT_SECRET;
    const apiPublicUrl = process.env.API_PUBLIC_URL;

    if (
      !clientId ||
      !clientSecret ||
      !apiPublicUrl ||
      clientId.startsWith('example-') ||
      clientSecret.startsWith('example-')
    ) {
      throw new Error('Dropbox OAuth configuration is incomplete.');
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${apiPublicUrl}/cloud-connections/dropbox/callback`,
    };
  }
}

interface GoogleConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

interface DropboxConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}
