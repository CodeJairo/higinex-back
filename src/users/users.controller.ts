import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@Controller('users')
@Auth('ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@Query() query: GetUsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Get(':userId')
  getById(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.usersService.getUser(userId);
  }

  @Patch(':userId/status')
  setStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.setUserActive(userId, dto.isActive);
  }

  @Delete(':userId')
  remove(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.usersService.deleteUser(userId);
  }
}
