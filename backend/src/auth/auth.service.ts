import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { AuthUser } from './authz';
import { LoginCode } from './login-code.entity';

const CODE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const b64 = (s: string) => Buffer.from(s).toString('base64url');

export const authEnforced = () =>
  process.env.AUTH_ENFORCED ? process.env.AUTH_ENFORCED === 'true' : process.env.NODE_ENV === 'production';

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  private readonly secret: string;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(LoginCode) private readonly codes: Repository<LoginCode>,
  ) {
    if (process.env.AUTH_SECRET) {
      this.secret = process.env.AUTH_SECRET;
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set in production');
    } else {
      this.secret = randomBytes(32).toString('hex');
      this.log.warn('AUTH_SECRET is not set: using a random one, so sign-ins reset when the server restarts.');
    }
  }

  private showDevCode() {
    return process.env.AUTH_DEV_OTP ? process.env.AUTH_DEV_OTP === 'true' : process.env.NODE_ENV !== 'production';
  }

  private hash(email: string, code: string) {
    return createHmac('sha256', this.secret).update(`code:${email}:${code}`).digest('hex');
  }

  private sign(payload: string) {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  private normalise(email: string) {
    return (email ?? '').trim().toLowerCase();
  }

  /**
   * Starts an email sign-in. The answer is the same whether or not the email has an account.
   * TODO: no email provider is wired up yet. Outside dev the code is logged for the operator, not delivered.
   */
  async requestCode(rawEmail: string): Promise<{ sent: true; devCode?: string }> {
    const email = this.normalise(rawEmail);
    if (!email.includes('@')) throw new HttpException('Enter a valid email address.', HttpStatus.BAD_REQUEST);

    const recent = await this.codes.count({ where: { email, createdAt: MoreThan(new Date(Date.now() - WINDOW_MS)) } });
    if (recent >= MAX_CODES_PER_WINDOW) {
      throw new HttpException('Too many codes requested. Try again in a few minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.users.findOneBy({ email });
    if (!user) return { sent: true };

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.codes.save(
      this.codes.create({ email, codeHash: this.hash(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) }),
    );
    if (this.showDevCode()) return { sent: true, devCode: code };
    this.log.warn(`Sign-in code for ${email} generated but no email provider is configured.`);
    return { sent: true };
  }

  async verifyCode(rawEmail: string, code: string): Promise<{ token: string; user: User }> {
    const email = this.normalise(rawEmail);
    const fail = () => new UnauthorizedException('That code is not right or has expired.');

    const entry = await this.codes.findOne({
      where: { email, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    if (!entry || entry.consumedAt || entry.attempts >= MAX_ATTEMPTS) throw fail();

    entry.attempts += 1;
    await this.codes.save(entry);

    const given = Buffer.from(this.hash(email, (code ?? '').trim()));
    const real = Buffer.from(entry.codeHash);
    if (given.length !== real.length || !timingSafeEqual(given, real)) throw fail();

    entry.consumedAt = new Date();
    await this.codes.save(entry);

    const user = await this.users.findOneBy({ email });
    if (!user) throw fail();

    // The first admins are named by the operator in ADMIN_EMAILS; nobody can sign themselves up as one.
    const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (admins.includes(email) && !user.roles.includes(UserRole.ADMIN)) {
      user.roles = [...user.roles, UserRole.ADMIN];
      await this.users.save(user);
    }

    return { token: this.issueToken(user.id), user };
  }

  issueToken(userId: string): string {
    const payload = b64(JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_TTL_MS }));
    return `${payload}.${this.sign(payload)}`;
  }

  /** Returns the live user for a valid, unexpired token, otherwise null. Roles are read fresh each time. */
  async userFromToken(token: string): Promise<AuthUser | null> {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = Buffer.from(this.sign(payload));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number };
      if (!sub || typeof exp !== 'number' || exp < Date.now()) return null;
      const user = await this.users.findOneBy({ id: sub });
      return user ? { id: user.id, roles: user.roles } : null;
    } catch {
      return null;
    }
  }
}
