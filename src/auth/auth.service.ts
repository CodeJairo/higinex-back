import { Injectable, Logger } from '@nestjs/common';
import { RegisterUserDto } from './dto/register-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  register(registerUserDto: RegisterUserDto) {
    this.logger.log(registerUserDto);
    return { message: 'User registered successfully' };
  }
}
