import { createParamDecorator, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/user.entity';

export interface AuthUser {
  id: string;
  roles: UserRole[];
}

export const IS_PUBLIC = 'auth:public';
export const ROLES = 'auth:roles';

/** Reachable without signing in (registration, sign-in, storefront reads, provider webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Requires one of these roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** The signed-in user, or undefined when the request carries no token (only possible while AUTH_ENFORCED is off). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});

export const isAdmin = (u?: AuthUser) => !!u && u.roles.includes(UserRole.ADMIN);

/** Read access: the person themselves, or an admin. No-op when unauthenticated (AUTH_ENFORCED off). */
export function assertSelf(u: AuthUser | undefined, id: string | undefined) {
  if (!u) return;
  if (u.id !== id && !isAdmin(u)) throw new ForbiddenException('That does not belong to your account.');
}

/** Write access: only the person themselves. Admins do not act as buyers or sellers. */
export function assertIs(u: AuthUser | undefined, id: string | undefined) {
  if (!u) return;
  if (u.id !== id) throw new ForbiddenException('That does not belong to your account.');
}

/** Seller tools require an approved seller account. */
export function assertSeller(u: AuthUser | undefined) {
  if (!u) return;
  if (!u.roles.includes(UserRole.SELLER)) {
    throw new ForbiddenException('Your seller account has not been approved yet.');
  }
}
