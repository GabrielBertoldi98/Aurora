import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { cloudProviderSchema } from '@cloud-hub/contracts';
import type { Request, Response } from 'express';

import { PublicRoute } from '../auth/public-route.decorator.js';
import { ProvidersService } from '../providers/providers.service.js';
import { CloudConnectionsService } from './cloud-connections.service.js';

@Controller('cloud-connections')
export class CloudConnectionsController {
  constructor(
    @Inject(CloudConnectionsService) private readonly connections: CloudConnectionsService,
    @Inject(ProvidersService) private readonly providers: ProvidersService,
  ) {}

  @Get()
  listConnections(@Req() request: Request) {
    return this.connections.listForUser(this.getUserId(request));
  }

  @Post('google-drive/connect')
  beginGoogleDriveConnection(@Req() request: Request) {
    return this.connections.beginGoogleDriveConnection(this.getUserId(request));
  }

  @Post('dropbox/connect')
  beginDropboxConnection(@Req() request: Request) {
    return this.connections.beginDropboxConnection(this.getUserId(request));
  }

  @Get('google-drive/callback')
  @PublicRoute()
  async completeGoogleDriveConnection(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('Google OAuth callback is missing code or state.');
    }

    await this.connections.completeGoogleDriveConnection(code, state);
    return response.redirect(
      `${process.env.WEB_URL ?? 'http://localhost:3000'}?googleDrive=connected`,
    );
  }

  @Get('dropbox/callback')
  @PublicRoute()
  async completeDropboxConnection(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('Dropbox OAuth callback is missing code or state.');
    }

    await this.connections.completeDropboxConnection(code, state);
    return response.redirect(`${process.env.WEB_URL ?? 'http://localhost:3000'}?dropbox=connected`);
  }

  @Get(':connectionId/files')
  async listFiles(
    @Req() request: Request,
    @Param('connectionId') connectionId: string,
    @Query('parentRemoteId') parentRemoteId?: string,
    @Query('cursor') cursor?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = this.getUserId(request);
    const connection = await this.connections.getConnectionForUser(connectionId, userId);

    return this.providers.listFiles({
      connection: {
        connectionId,
        userId,
        provider: cloudProviderSchema.parse(connection.provider),
      },
      parentRemoteId: parentRemoteId ?? null,
      cursor: cursor ?? null,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  private getUserId(request: Request): string {
    const userId = request.authSession?.user.id;

    if (!userId) {
      throw new UnauthorizedException();
    }

    return userId;
  }
}
