import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../demo/demo.constants';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Seed admin user
    if (process.env.SEED_ADMIN === 'true') {
      await this.seedAdminUser();
    }

    // Seed demo users
    if (process.env.SEED_DEMO === 'true') {
      await this.seedDemoUsers();
    }
  }

  private async seedAdminUser() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const saltRounds = process.env.SALT_ROUNDS;

    if (!email || !password || !saltRounds) {
      throw new Error(
        'SEED_ADMIN=true requires ADMIN_EMAIL, ADMIN_PASSWORD and SALT_ROUNDS',
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
        email: { not: DEMO_ACCOUNTS.admin }, // Exclude demo admin
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

  private async seedDemoUsers() {
    const saltRounds = Number(process.env.SALT_ROUNDS) || 10;
    const demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, saltRounds);

    // Seed Demo Admin
    const existingDemoAdmin = await this.prisma.user.findUnique({
      where: { email: DEMO_ACCOUNTS.admin },
    });

    if (!existingDemoAdmin) {
      await this.prisma.user.create({
        data: {
          email: DEMO_ACCOUNTS.admin,
          password: demoPasswordHash,
          role: Role.ADMIN,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      });
      this.logger.log(`Demo admin created: ${DEMO_ACCOUNTS.admin}`);
    } else {
      this.logger.log(`Demo admin already exists: ${DEMO_ACCOUNTS.admin}`);
    }

    // Seed Demo User (with linked Customer)
    const existingDemoUser = await this.prisma.user.findUnique({
      where: { email: DEMO_ACCOUNTS.user },
      include: { customer: true },
    });

    if (!existingDemoUser) {
      await this.prisma.user.create({
        data: {
          email: DEMO_ACCOUNTS.user,
          password: demoPasswordHash,
          role: Role.USER,
          isActive: true,
          emailVerifiedAt: new Date(),
          customer: {
            create: {
              email: DEMO_ACCOUNTS.user,
              phone: '+57 300 123 4567',
              name: 'Empresa Demo S.A.S',
              documentType: 'NIT',
              documentNumber: '900123456-1',
            },
          },
        },
      });
      this.logger.log(`Demo user created: ${DEMO_ACCOUNTS.user}`);
    } else {
      this.logger.log(`Demo user already exists: ${DEMO_ACCOUNTS.user}`);
    }

    this.logger.log('Demo users seeding completed');
  }
}
