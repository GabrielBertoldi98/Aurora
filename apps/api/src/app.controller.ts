import { Controller, Get } from '@nestjs/common';

import { PublicRoute } from './auth/public-route.decorator.js';

export interface HealthResponse {
  readonly service: 'api';
  readonly status: 'ok';
}

@Controller('health')
export class AppController {
  @Get()
  @PublicRoute()
  getHealth(): HealthResponse {
    return { service: 'api', status: 'ok' };
  }
}
