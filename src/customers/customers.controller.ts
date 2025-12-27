import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { CustomersService } from './customers.service';
import { GetCustomersQueryDto } from './dto/get-customers-query.dto';

@Controller('customers')
@Auth('ADMIN')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async list(@Query() query: GetCustomersQueryDto) {
    return await this.customersService.listCustomers(query);
  }

  @Get(':customerId')
  async getById(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return await this.customersService.getCustomer(customerId);
  }

  @Get(':customerId/contracts')
  async listContracts(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return await this.customersService.listCustomerContracts(customerId);
  }
}
