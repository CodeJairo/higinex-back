import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import type { ValidatedUserPayload } from './interfaces/validated-user-payload.interface';
import { getCookieValue } from 'src/common/helpers/cookie.helper';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Auth('ADMIN')
  @HttpCode(201)
  register(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.register(registerUserDto);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');

    const { refreshToken, ...body } =
      await this.authService.login(loginUserDto);

    res.cookie(
      this.config.get<string>('AUTH_REFRESH_COOKIE_NAME')!,
      refreshToken,
      this.getRefreshCookieOptions(),
    );

    return body;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');

    const refreshToken = getCookieValue(
      req.headers.cookie,
      this.config.get<string>('AUTH_REFRESH_COOKIE_NAME')!,
    );
    const tokens = await this.authService.refresh(refreshToken);

    res.cookie(
      this.config.get<string>('AUTH_REFRESH_COOKIE_NAME')!,
      tokens.refreshToken,
      this.getRefreshCookieOptions(),
    );

    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(
      this.config.get<string>('AUTH_REFRESH_COOKIE_NAME')!,
      this.getRefreshCookieOptions(),
    );

    return { ok: true };
  }

  @Get('me')
  @Auth()
  @HttpCode(200)
  me(@CurrentUser() user: ValidatedUserPayload) {
    return user;
  }

  private getRefreshCookieOptions() {
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>(
      'AUTH_COOKIE_SAMESITE',
    );
    const secure =
      this.config.get<boolean>('AUTH_COOKIE_SECURE', false) ||
      this.config.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      sameSite,
      secure,
    } as const;
  }
}
