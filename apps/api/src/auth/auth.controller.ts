import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller('me')
export class AuthController {
  @Get()
  getCurrentUser(@Req() request: Request) {
    return request.authSession;
  }
}
