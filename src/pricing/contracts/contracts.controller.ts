import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpsertContractItemsDto } from './dto/upsert-contract-items.dto';

@Controller('contracts')
@Auth('ADMIN')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post(':customerId')
  async create(
    @Param('customerId') customerId: string,
    @Body() createContractDto: CreateContractDto,
  ) {
    return await this.contractsService.createContract(
      customerId,
      createContractDto,
    );
  }

  @Put(':contractId/items')
  async upsertItems(
    @Param('contractId') contractId: string,
    @Body() upsertContractItemsDto: UpsertContractItemsDto,
  ) {
    return await this.contractsService.upsertContractItems(
      contractId,
      upsertContractItemsDto,
    );
  }

  @Get(':contractId')
  getById(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.contractsService.getContract(contractId);
  }

  @Get(':contractId/items')
  listItems(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.contractsService.listContractItems(contractId);
  }
}
