import { Controller, Post, UseGuards, Request, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { RegisterAuthDto } from './dto/register-auth.dto'; // <--- IMPORTANTE: El DTO que creamos antes

@Controller('auth')
export class AuthController {
  
  constructor(private authService: AuthService) {}

  /**
   * LOGIN (Entrada para usuarios ya registrados)
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  /**
   * REGISTER (NUEVO: Para crear usuarios nuevos con referido)
   * Recibe nombre, email, password y OPCIONALMENTE el referralCode
   */
  @Post('register')
  async register(@Body() registerDto: RegisterAuthDto) {
    return this.authService.register(registerDto);
  }
}