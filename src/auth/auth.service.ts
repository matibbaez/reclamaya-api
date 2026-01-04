import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, UserRole } from 'src/users/entities/user.entity';
import { RegisterAuthDto } from './dto/register-auth.dto';

@Injectable()
export class AuthService {
  
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(User) private userRepository: Repository<User>, 
  ) {}

  // -----------------------------------------------------
  // VALIDAR USUARIO
  // -----------------------------------------------------
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  // -----------------------------------------------------
  // LOGIN
  // -----------------------------------------------------
  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        role: user.role,
        nombre_completo: user.nombre 
      }
    };
  }

  // -----------------------------------------------------
  // REGISTRO
  // -----------------------------------------------------
  async register(registerDto: RegisterAuthDto) {
    
    // 1. Validar email
    const userExiste = await this.userRepository.findOne({ where: { email: registerDto.email } });
    if (userExiste) throw new BadRequestException('El email ya está registrado.');

    // 2. Buscar Padre (Referido)
    let usuarioPadre: User | null = null;
    
    if (registerDto.referralCode) {
      usuarioPadre = await this.userRepository.findOne({ 
        where: { id: registerDto.referralCode } 
      });
      
      if (!usuarioPadre) {
        console.warn(`Código de referido no encontrado: ${registerDto.referralCode}`);
      }
    }

    // 3. Hash Password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // 4. Crear Usuario
    const newUser = this.userRepository.create({
      nombre: registerDto.nombre,
      email: registerDto.email,
      password: hashedPassword,
      dni: registerDto.dni,
      telefono: registerDto.telefono,
      
      matricula: registerDto.matricula, 

      role: UserRole.PRODUCTOR, 
      referidoPor: usuarioPadre || undefined // Usar undefined si es null para evitar conflicto de tipos
    });

    await this.userRepository.save(newUser);

    return { message: 'Usuario registrado con éxito', userId: newUser.id };
  }
}