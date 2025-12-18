import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getVariantPriceForUser(userId: string, variantId: string) {
    try {
      const customer = await this.prisma.customer.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true },
      });

      if (!customer)
        throw new BadRequestException('Customer profile not found for user');

      const now = new Date();
      const contract = await this.prisma.contract.findFirst({
        where: {
          customerId: customer.id,
          isActive: true,
          deletedAt: null,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (!contract) throw new NotFoundException('Active contract not found');

      const item = await this.prisma.contractItem.findUnique({
        where: {
          contractId_variantId: { contractId: contract.id, variantId },
        },
        select: { unitPriceCop: true },
      });

      if (!item) throw new NotFoundException('Price not found for variant');

      return { variantId, unitPriceCop: item.unitPriceCop };
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'PricingService.getVariantPriceForUser',
        defaultMessage: 'Failed to get variant price',
      });
    }
  }
}
