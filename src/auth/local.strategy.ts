import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  
  constructor(private authService: AuthService) {
    // Le decimos a Passport que el "username" va a ser el campo 'email'
    super({ usernameField: 'email' });
  }

  // ¡ESTA ES LA MAGIA!
  // Passport va a llamar a esta función automáticamente
  // cuando alguien intente loguearse.
  async validate(email: string, password: string): Promise<any> {
    
    // 1. Llama a nuestro "cerebro" (AuthService)
    const user = await this.authService.validateUser(email, password);
    
    // 2. Si el cerebro dice "null" o "error"...
    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    
    // 3. Si el cerebro dice "OK", devolvemos el usuario
    return user;
  }
}