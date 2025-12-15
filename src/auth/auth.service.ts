import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginUserResponse } from './interfaces/login-user-response.interface';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserJwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';

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

      return await this.prisma.user.create({
        data,
        include: { customer: true },
      });
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

      const loginUserResponse: LoginUserResponse = {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        customer: user.customer || undefined,
        accessToken: await this.getJwtToken(user),
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

  private async getJwtToken(payload: UserJwtPayload): Promise<string> {
    const { id, email, role } = payload;
    return this.jwtService.signAsync({ id, email, role });
  }
}
