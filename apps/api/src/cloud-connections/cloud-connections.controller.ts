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

  @Get(':connectionId/files')
  listGoogleDriveFiles(
    @Req() request: Request,
    @Param('connectionId') connectionId: string,
    @Query('parentRemoteId') parentRemoteId?: string,
    @Query('cursor') cursor?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.providers.listFiles({
      connection: {
        connectionId,
        userId: this.getUserId(request),
        provider: 'google-drive',
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
