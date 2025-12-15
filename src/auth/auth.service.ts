import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserDto } from './dto/register-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
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
}
