import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetCustomersQueryDto } from './dto/get-customers-query.dto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers({ limit = 10, offset = 0, q }: GetCustomersQueryDto) {
    try {
      const query = q?.trim();
      return await this.prisma.customer.findMany({
        where: {
          deletedAt: null,
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                  { phone: { contains: query, mode: 'insensitive' } },
                  { documentNumber: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          documentType: true,
          documentNumber: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'CustomersService.listCustomers',
        defaultMessage: 'Failed to list customers',
      });
    }
  }

  async getCustomer(customerId: string) {
    try {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          documentType: true,
          documentNumber: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!customer) throw new NotFoundException('Customer not found');

      return customer;
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'CustomersService.getCustomer',
        defaultMessage: 'Failed to get customer',
      });
    }
  }

  async listCustomerContracts(customerId: string) {
    try {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, deletedAt: null },
        select: { id: true },
      });

      if (!customer) throw new NotFoundException('Customer not found');

      return await this.prisma.contract.findMany({
        where: { customerId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          customerId: true,
          isActive: true,
          startsAt: true,
          endsAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { items: true } },
        },
      });
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'CustomersService.listCustomerContracts',
        defaultMessage: 'Failed to list customer contracts',
      });
    }
  }
}
