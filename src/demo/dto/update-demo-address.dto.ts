import { PartialType } from '@nestjs/mapped-types';
import { CreateDemoAddressDto } from './create-demo-address.dto';

export class UpdateDemoAddressDto extends PartialType(CreateDemoAddressDto) {}
