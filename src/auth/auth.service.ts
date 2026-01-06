import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
      
      // Si no está aprobado, lanzamos error específico
      if (!user.isApproved) {
        throw new ForbiddenException('Tu cuenta está pendiente de aprobación por un administrador.');
      }

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
    const userExiste = await this.userRepository.findOne({ where: { email: registerDto.email } });
    if (userExiste) throw new BadRequestException('El email ya está registrado.');

    let usuarioPadre: User | null = null;
    if (registerDto.referralCode) {
      usuarioPadre = await this.userRepository.findOne({ where: { id: registerDto.referralCode } });
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const newUser = this.userRepository.create({
      nombre: registerDto.nombre,
      email: registerDto.email,
      password: hashedPassword,
      dni: registerDto.dni,
      telefono: registerDto.telefono,
      matricula: registerDto.matricula,
      
      role: UserRole.PRODUCTOR,
      referidoPor: usuarioPadre || undefined,
      
      isApproved: false 
    });

    await this.userRepository.save(newUser);

    return { message: 'Registro exitoso. Espera la aprobación del administrador.', userId: newUser.id };
  }
}