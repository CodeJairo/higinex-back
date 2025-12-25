import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.SEED_ADMIN !== 'true') return;

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const saltRounds = process.env.SALT_ROUNDS;

    if (!email || !password || !saltRounds) {
      throw new Error(
        'SEED_ADMIN=true requires ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME and SALT_ROUNDS',
      );
    }

    const rounds = Number(saltRounds);
    if (!Number.isInteger(rounds) || rounds < 8 || rounds > 15) {
      throw new Error('SALT_ROUNDS must be an integer between 8 and 15');
    }

    const existingAdmin = await this.prisma.user.findFirst({
      where: {
        role: Role.ADMIN,
        isActive: true,
      },
    });

    if (existingAdmin) {
      this.logger.log(`Admin user already exists: ${existingAdmin.email}`);
      return;
    }

    await this.prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, rounds),
        role: Role.ADMIN,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });

    this.logger.log(`Admin user created successfully: ${email}`);
  }
}
