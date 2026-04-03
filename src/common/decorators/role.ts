import { SetMetadata } from '@nestjs/common';
import { jekRoles } from '@prisma/client';

export const Roles = (...roles: jekRoles[]) => SetMetadata('roles', roles);
