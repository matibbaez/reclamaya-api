import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  
  constructor(private readonly configService: ConfigService) {
    
    // --- ¡AQUÍ ESTÁ EL ARREGLO! ---

    // 1. Obtenemos la llave secreta del .env
    const secret = configService.get<string>('JWT_SECRET');

    // 2. Verificamos que exista (¡la cláusula de guarda!)
    if (!secret) {
      throw new Error('Error: JWT_SECRET no está definida en el archivo .env');
    }

    // 3. Ahora SÍ llamamos a super()
    super({
      // Le decimos que busque el "sello" (Token) en el encabezado
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      
      // No ignoramos si el token expiró (¡seguridad!)
      ignoreExpiration: false,
      
      // ¡Ahora TypeScript sabe que 'secret' es un string sí o sí!
      secretOrKey: secret,
    });
  }

  // 4. ¡La magia! (Esto queda igual)
  // Si el "sello" (Token) es válido, Passport lo decodifica
  // y nos pasa el "payload" (la data de adentro) a esta función.
  async validate(payload: any) {
    // ESTO ESTABA INCOMPLETO:
    /* return { 
       id: payload.sub, 
       email: payload.email, 
       nombre: payload.nombre 
    }; */

    // 👇 ASÍ DEBE SER (Agregá 'role'):
    return { 
      id: payload.sub, 
      email: payload.email, 
      nombre: payload.nombre,
      role: payload.role // 👈 ¡IMPORTANTÍSIMO!
    };
  }
}