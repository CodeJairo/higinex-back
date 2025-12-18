import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { UpsertContractItemsDto } from './dto/upsert-contract-items.dto';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async createContract(
    customerId: string,
    createContractDto: CreateContractDto,
  ) {
    try {
      const now = new Date();
      const startsAt = createContractDto.startsAt
        ? new Date(createContractDto.startsAt)
        : now;
      const endsAt = createContractDto.endsAt
        ? new Date(createContractDto.endsAt)
        : undefined;

      if (endsAt && endsAt.getTime() < startsAt.getTime())
        throw new BadRequestException('endsAt must be after startsAt');

      return await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findFirst({
          where: { id: customerId, deletedAt: null },
          select: { id: true },
        });

        if (!customer) throw new NotFoundException('Customer not found');

        await tx.contract.updateMany({
          where: { customerId, isActive: true, deletedAt: null },
          data: { isActive: false, endsAt: now },
        });

        return await tx.contract.create({
          data: {
            customerId,
            isActive: true,
            startsAt,
            ...(endsAt ? { endsAt } : {}),
          },
          include: { items: true },
        });
      });
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ContractsService.createContract',
        defaultMessage: 'Failed to create contract',
      });
    }
  }

  async upsertContractItems(
    contractId: string,
    upsertContractItemsDto: UpsertContractItemsDto,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const contract = await tx.contract.findFirst({
          where: { id: contractId, deletedAt: null },
          select: { id: true },
        });
        if (!contract) throw new NotFoundException('Contract not found');

        const requestedVariantIds = Array.from(
          new Set(upsertContractItemsDto.items.map((i) => i.variantId)),
        );

        const existingVariants = await tx.productVariant.findMany({
          where: {
            id: { in: requestedVariantIds },
            deletedAt: null,
          },
          select: { id: true },
        });

        if (existingVariants.length !== requestedVariantIds.length)
          throw new BadRequestException(
            'One or more variants do not exist or are deleted',
          );

        await Promise.all(
          upsertContractItemsDto.items.map((item) =>
            tx.contractItem.upsert({
              where: {
                contractId_variantId: { contractId, variantId: item.variantId },
              },
              create: {
                contractId,
                variantId: item.variantId,
                unitPriceCop: item.unitPriceCop,
              },
              update: { unitPriceCop: item.unitPriceCop },
            }),
          ),
        );

        return await tx.contractItem.findMany({
          where: { contractId },
          orderBy: { updatedAt: 'desc' },
        });
      });
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ContractsService.upsertContractItems',
        defaultMessage: 'Failed to upsert contract items',
      });
    }
  }

  async listContractItems(contractId: string) {
    try {
      const contract = await this.prisma.contract.findFirst({
        where: { id: contractId, deletedAt: null },
        select: { id: true },
      });

      if (!contract) throw new NotFoundException('Contract not found');

      return await this.prisma.contractItem.findMany({
        where: { contractId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          variantId: true,
          unitPriceCop: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ContractsService.listContractItems',
        defaultMessage: 'Failed to list contract items',
      });
    }
  }
}
