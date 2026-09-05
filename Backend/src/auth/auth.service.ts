import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../common/redis/redis.service';
import { ApiError } from '../common/api-error';
import {
  publicUserSelect,
  serializeClientProfile,
  serializeTrainerProfile,
} from '../common/serialize-user';
import {
  isOnboardingComplete,
  onboardingStatus,
} from '../onboarding/onboarding-fields';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string) {
    if (dto.role === Role.ADMIN) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'FORBIDDEN_ROLE',
        'Cannot register as admin.',
      );
    }

    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'EMAIL_TAKEN',
        'An account with this email already exists.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: dto.fullName.trim(),
          email,
          phone: dto.phone,
          passwordHash,
          role: dto.role,
        },
        select: publicUserSelect,
      });

      if (dto.role === Role.CLIENT) {
        await tx.clientProfile.create({ data: { userId: created.id } });
      }
      if (dto.role === Role.TRAINER) {
        await tx.trainerProfile.create({ data: { userId: created.id } });
        await tx.wallet.create({ data: { userId: created.id } });
      }

      return created;
    });

    return this.issueTokens(user, userAgent);
  }

  async login(dto: LoginDto, userAgent?: string) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Email or password is incorrect.',
      );
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Email or password is incorrect.',
      );
    }

    const result = await this.issueTokens(user, userAgent);
    if (!result.user.onboardingComplete) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'ONBOARDING_INCOMPLETE',
        result.user.missing.length
          ? `Onboarding is not complete. Missing: ${result.user.missing.join(', ')}`
          : 'Onboarding is not complete.',
        {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
          missing: result.user.missing,
          onboardingComplete: false,
        },
      );
    }
    return result;
  }

  async refresh(refreshToken: string, userAgent?: string) {
    const hashedToken = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { hashedToken, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: publicUserSelect } },
    });
    if (!stored || stored.user.status !== UserStatus.ACTIVE) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Refresh token is invalid.',
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user, userAgent);
  }

  async logout(refreshToken: string, accessToken?: string) {
    const hashedToken = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { hashedToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (accessToken) {
      try {
        const payload = await this.jwt.verifyAsync<{ jti?: string }>(
          accessToken,
        );
        if (payload.jti) {
          await this.redis.denyAccessJti(
            payload.jti,
            accessTtlSeconds(this.config.get('JWT_ACCESS_TTL', '15m')),
          );
        }
      } catch {
        // Refresh is already revoked; ignore a malformed access token.
      }
    }

    return { ok: true };
  }

  async forgotPassword(emailRaw: string) {
    const email = emailRaw.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const expose =
      this.config.get('NODE_ENV') !== 'production' &&
      user?.status === UserStatus.ACTIVE;

    let resetToken: string | undefined;
    if (user?.status === UserStatus.ACTIVE) {
      resetToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await this.prisma.$transaction([
        this.prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            hashedToken: hashToken(resetToken),
            expiresAt,
          },
        }),
      ]);

      await this.mail.sendPasswordReset(email, resetToken);
    }

    return expose && resetToken
      ? { accepted: true, resetToken }
      : { accepted: true };
  }

  async resetPassword(token: string, password: string) {
    const stored = await this.prisma.passwordResetToken.findFirst({
      where: {
        hashedToken: hashToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!stored) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Reset token is invalid or expired.',
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.redis.revokeUserAccess(stored.userId);

    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        clientProfile: true,
        trainerProfile: { include: { certifications: true } },
      },
    });

    const { missing, onboardingComplete } = onboardingStatus(user);

    return {
      ...pickPublic(user),
      onboardingComplete,
      missing,
      clientProfile: serializeClientProfile(user.clientProfile),
      trainerProfile: serializeTrainerProfile(
        user.trainerProfile,
        user.trainerProfile?.certifications ?? [],
      ),
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });
    return this.me(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Current password is incorrect.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) },
      }),
    ]);
    await this.redis.revokeUserAccess(userId);
    return { ok: true };
  }

  async deleteMe(userId: string) {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          email: `deleted_${userId}@deleted.local`,
          phone: null,
          fullName: 'Deleted User',
          avatarUrl: null,
        },
      }),
    ]);
    await this.redis.revokeUserAccess(userId);
    return { ok: true };
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const device = await this.prisma.device.upsert({
      where: {
        userId_pushToken: { userId, pushToken: dto.pushToken },
      },
      create: {
        userId,
        pushToken: dto.pushToken,
        platform: dto.platform,
      },
      update: { platform: dto.platform },
    });
    return { id: device.id, platform: device.platform, ok: true };
  }

  private async issueTokens(user: { id: string; role: Role }, userAgent?: string) {
    const jti = randomBytes(16).toString('hex');
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      jti,
    });
    const refreshToken = randomBytes(48).toString('hex');
    const days = parseTtlDays(this.config.get('JWT_REFRESH_TTL', '30d'));
    const expiresAt = new Date(Date.now() + days * 86400000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        hashedToken: hashToken(refreshToken),
        expiresAt,
        userAgent: userAgent?.slice(0, 255),
      },
    });

    const publicUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        clientProfile: true,
        trainerProfile: true,
      },
    });
    const { missing, onboardingComplete } = onboardingStatus(publicUser);

    return {
      user: { ...pickPublic(publicUser), onboardingComplete, missing },
      accessToken,
      refreshToken,
    };
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function parseTtlDays(ttl: string) {
  const match = /^(\d+)d$/.exec(ttl);
  return match ? Number(match[1]) : 30;
}

export function accessTtlSeconds(ttl: string) {
  const mins = /^(\d+)m$/.exec(ttl);
  if (mins) return Number(mins[1]) * 60;
  const secs = /^(\d+)s$/.exec(ttl);
  if (secs) return Number(secs[1]);
  const hours = /^(\d+)h$/.exec(ttl);
  if (hours) return Number(hours[1]) * 3600;
  return 15 * 60;
}

function pickPublic(user: {
  id: string;
  role: Role;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  onboardingStep: number;
  onboardingCompletedAt: Date | null;
  status: UserStatus;
  createdAt: Date;
}) {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    onboardingStep: user.onboardingStep,
    onboardingCompletedAt: user.onboardingCompletedAt,
    onboardingComplete: isOnboardingComplete(user.onboardingCompletedAt),
    status: user.status,
    createdAt: user.createdAt,
  };
}
