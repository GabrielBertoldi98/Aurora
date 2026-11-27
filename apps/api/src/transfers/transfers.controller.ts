import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { createTransferSchema } from '@cloud-hub/contracts';
import type { Request } from 'express';

import { TransfersService } from './transfers.service.js';

@Controller('transfers')
export class TransfersController {
  constructor(@Inject(TransfersService) private readonly transfers: TransfersService) {}

  @Get()
  list(@Req() request: Request) {
    return this.transfers.list(this.getUserId(request));
  }

  @Get(':transferId')
  get(@Req() request: Request, @Param('transferId') transferId: string) {
    return this.transfers.get(this.getUserId(request), transferId);
  }

  @Post()
  create(@Req() request: Request, @Body() body: unknown) {
    return this.transfers.create(this.getUserId(request), createTransferSchema.parse(body));
  }

  @Post(':transferId/cancel')
  cancel(@Req() request: Request, @Param('transferId') transferId: string) {
    return this.transfers.cancel(this.getUserId(request), transferId);
  }

  private getUserId(request: Request): string {
    const userId = request.authSession?.user.id;

    if (!userId) {
      throw new Error('Authenticated user is required.');
    }

    return userId;
  }
}
