import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt'; 
import { User, UserRole } from './entities/user.entity';
import { MailService } from 'src/mail/mail.service'; 

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService
  ) {}

  // CREAR USUARIO
  async create(createUserDto: CreateUserDto): Promise<User> {
    const existe = await this.userRepository.findOne({ where: { email: createUserDto.email } });
    if (existe) throw new BadRequestException('El email ya está registrado.');

    let padre: User | null = null; 
    
    // Lógica para buscar por ID (si viene del frontend) o Email (si viene de tu lógica anterior)
    // Adaptado para soportar ambos casos por seguridad
    if (createUserDto.referralCode) {
        padre = await this.userRepository.findOne({ where: { id: createUserDto.referralCode } });
    } else if (createUserDto.emailReferido) {
        padre = await this.userRepository.findOne({ where: { email: createUserDto.emailReferido } });
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const newUser = this.userRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      nombre: createUserDto.nombre,
      role: createUserDto.role || UserRole.PRODUCTOR,
      dni: createUserDto.dni,
      telefono: createUserDto.telefono,
      matricula: createUserDto.matricula,
      referidoPor: padre || null,
    });

    return this.userRepository.save(newUser);
  }

  async findAll(role?: string, approvedStr?: string) {
    const where: any = {};
    
    if (role) where.role = role;
    if (approvedStr !== undefined) {
        where.isApproved = approvedStr === 'true';
    }

    return this.userRepository.find({ 
      where,
      order: { createdAt: 'DESC' } 
    });
  }

  async approveUser(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    user.isApproved = true;
    await this.userRepository.save(user);

    // Enviar email
    console.log(`✅ Usuario ${user.email} aprobado. Enviando mail...`);
    await this.mailService.sendAccountApproved(user.email, user.nombre);

    return { message: 'Usuario aprobado correctamente' };
  }

  findOneByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  update(id: string, updateUserDto: UpdateUserDto) {
    return this.userRepository.update(id, updateUserDto);
  }

  remove(id: string) {
    return this.userRepository.delete(id);
  }

  // -----------------------------------------------------
  // ✅ MÉTODO RESTAURADO: TRAER MIS REFERIDOS
  // -----------------------------------------------------
  async findReferidos(padreId: string) {
    return this.userRepository.find({
      where: { 
        referidoPor: { id: padreId } 
      },
      relations: ['reclamos_cargados'], // Importante: Trae los reclamos para contarlos
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
        telefono: true,
        matricula: true,
        createdAt: true,
      },
      order: {
        createdAt: 'DESC'
      }
    });
  }
}