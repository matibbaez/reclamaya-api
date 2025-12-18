import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// 1. IMPORTAMOS User Y UserRole
import { User, UserRole } from 'src/users/entities/user.entity';
import { RegisterAuthDto } from './dto/register-auth.dto';

@Injectable()
export class AuthService {
  
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(User) private userRepository: Repository<User>, 
  ) {}

  // ... (validateUser y login dejalos igual) ...
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    throw new UnauthorizedException('Credenciales incorrectas');
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, nombre: user.nombre, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, nombre: user.nombre, role: user.role }
    };
  }

  // --- REGISTER CORREGIDO ---
  async register(registerDto: RegisterAuthDto) {
    
    // Validar email
    const userExiste = await this.userRepository.findOne({ where: { email: registerDto.email } });
    if (userExiste) throw new BadRequestException('El email ya está registrado.');

    // Buscar Padre
    let usuarioPadre: User | null = null; // Tipado explícito
    if (registerDto.referralCode) {
      usuarioPadre = await this.userRepository.findOne({ 
        where: { id: registerDto.referralCode } 
      });
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Crear Usuario
    const newUser = this.userRepository.create({
      nombre: registerDto.nombre,
      email: registerDto.email,
      password: hashedPassword,
      dni: registerDto.dni,
      telefono: registerDto.telefono,
      
      // 2. CORRECCIÓN: Usamos el Enum, no el string
      role: UserRole.PRODUCTOR, 
      
      // 3. CORRECCIÓN: Asignación simple (TypeORM maneja el null si usuarioPadre es null)
      referidoPor: usuarioPadre 
    });

    await this.userRepository.save(newUser);

    return { message: 'Usuario registrado con éxito', userId: newUser.id };
  }
}