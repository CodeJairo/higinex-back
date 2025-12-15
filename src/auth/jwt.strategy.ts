import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserJwtPayload } from './interfaces/jwt-payload.interface';
import { ValidatedUserPayload } from './interfaces/validated-user-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload: UserJwtPayload): Promise<ValidatedUserPayload> {
    const { id } = payload;

    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: { password: true },
    });

    if (!user)
      throw new UnauthorizedException('Invalid Credentials - User not found');

    if (!user.isActive)
      throw new ForbiddenException('Invalid Credentials - User is inactive');

    return user;
  }
}
