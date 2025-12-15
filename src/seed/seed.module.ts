import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SeedService } from './seed.service';

@Module({
  providers: [SeedService],
  imports: [PrismaModule],
})
export class SeedModule {}
