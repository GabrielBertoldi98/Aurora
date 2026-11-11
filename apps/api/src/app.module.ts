import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { SessionGuard } from './auth/session.guard.js';
import { ProvidersModule } from './providers/providers.module.js';

@Module({
  imports: [ProvidersModule],
  controllers: [AppController, AuthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
  ],
})
export class AppModule {}
