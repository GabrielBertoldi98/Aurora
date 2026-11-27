import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { SessionGuard } from './auth/session.guard.js';
import { CloudConnectionsModule } from './cloud-connections/cloud-connections.module.js';
import { CloudConnectionsController } from './cloud-connections/cloud-connections.controller.js';
import { ProvidersModule } from './providers/providers.module.js';
import { TransfersModule } from './transfers/transfers.module.js';

@Module({
  imports: [CloudConnectionsModule, ProvidersModule, TransfersModule],
  controllers: [AppController, AuthController, CloudConnectionsController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
  ],
})
export class AppModule {}
