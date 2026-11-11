import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../users/user.entity';
import { authEnforced, AuthService } from './auth.service';
import { IS_PUBLIC, ROLES } from './authz';

/**
 * Global guard. A valid bearer token always identifies the caller. Whether a missing token is
 * refused depends on AUTH_ENFORCED (on in production; off by default elsewhere so the mobile
 * app, which cannot sign in yet, keeps working against a dev server).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);

    const header = req.headers?.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (token) {
      const user = await this.auth.userFromToken(token);
      if (!user) throw new UnauthorizedException('Your session has expired. Please sign in again.');
      req.user = user;
    }

    if (!req.user) {
      if (isPublic || !authEnforced()) return true;
      throw new UnauthorizedException('Please sign in to continue.');
    }
    if (roles && !roles.some((r) => req.user.roles.includes(r))) {
      throw new ForbiddenException('You do not have permission to do that.');
    }
    return true;
  }
}
