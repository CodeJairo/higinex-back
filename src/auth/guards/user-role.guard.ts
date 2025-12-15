import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Roles } from '../decorators/roles.decorator';
import { ValidatedUserPayload } from '../interfaces/validated-user-payload.interface';
import { Request } from 'express';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const validRoles = this.reflector.get(Roles, context.getHandler());

    const req: Request = context.switchToHttp().getRequest();
    const user = req.user as ValidatedUserPayload;
    if (!user) throw new BadRequestException('User not found');

    if (!validRoles.includes(user.role))
      throw new ForbiddenException(
        `Access denied - Requires one of the following roles: ${validRoles.join(', ')}`,
      );

    return true;
  }
}
