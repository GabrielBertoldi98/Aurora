import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_ROUTE = 'isPublicRoute';
export const PublicRoute = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_ROUTE, true);
