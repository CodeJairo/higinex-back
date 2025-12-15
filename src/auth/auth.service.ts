import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserDto } from './dto/register-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async register(registerUserDto: RegisterUserDto) {
    try {
      const { email, password, customer } = registerUserDto;

      const data: Prisma.UserCreateInput = {
        email,
        password,
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
