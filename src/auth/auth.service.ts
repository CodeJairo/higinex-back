import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import {
  RefreshJwtPayload,
  UserJwtPayload,
} from './interfaces/jwt-payload.interface';
import { LoginUserResponse } from './interfaces/login-user-response.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(registerUserDto: RegisterUserDto) {
    try {
      const { email, password, customer } = registerUserDto;

      const saltRounds = this.configService.get<number>('SALT_ROUNDS')!;
      const data: Prisma.UserCreateInput = {
        email,
        password: await bcrypt.hash(password, saltRounds),
        ...(customer && { customer: { create: customer } }),
      };

      await this.prisma.user.create({
        data,
        include: { customer: true },
      });
      return { message: 'User registered successfully' };
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'AuthService.register',
        defaultMessage: 'Failed to register user',
      });
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
        include: { customer: true },
      });

      if (!user) throw new BadRequestException('User not found');

      if (user.isActive === false)
        throw new ForbiddenException('User account is inactive');

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid)
        throw new UnauthorizedException('Invalid credentials - password');

      const { accessToken, refreshToken } = await this.issueTokens({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const loginUserResponse: LoginUserResponse & { refreshToken: string } = {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        customer: user.customer || undefined,
        accessToken,
        refreshToken,
      };

      return loginUserResponse;
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'AuthService.login',
        defaultMessage: 'Failed to login user',
      });
    }
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');

    let payload: RefreshJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshJwtPayload>(
        refreshToken,
        { secret },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh')
      throw new UnauthorizedException('Invalid refresh token');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      omit: { password: true },
    });

    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid refresh token');

    return this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private async issueTokens(user: UserJwtPayload) {
    const accessToken = await this.getAccessToken(user);
    const refreshToken = await this.getRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  private async getAccessToken(payload: UserJwtPayload): Promise<string> {
    const { id, email, role } = payload;
    return this.jwtService.signAsync({ id, email, role });
  }

  private async getRefreshToken(userId: string): Promise<string> {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');

    return this.jwtService.signAsync<RefreshJwtPayload>(
      { sub: userId, tokenType: 'refresh', jti: randomUUID() },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      { secret, expiresIn: expiresIn as any },
    );
  }
}
