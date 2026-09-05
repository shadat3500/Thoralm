import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { ApiError } from '../common/api-error';

export type JwtPayload = {
  sub: string;
  role: string;
  jti?: string;
  iat?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.jti && (await this.redis.isAccessDenied(payload.jti))) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Access token is invalid.',
      );
    }
    if (await this.redis.isUserAccessRevoked(payload.sub, payload.iat)) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Access token is invalid.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Access token is invalid.',
      );
    }
    return { id: user.id, role: user.role };
  }
}
