import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt'; 
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // ¡ESTE ES EL MÉTODO QUE VA A "HACER LA MAGIA"!
  async create(createUserDto: CreateUserDto): Promise<User> {
    
    // 1. Verificar si el email ya existe
    const existe = await this.userRepository.findOne({ where: { email: createUserDto.email } });
    if (existe) throw new BadRequestException('El email ya está registrado.');

    // 2. Buscar al "Padre" (Referido)
    // CAMBIO CLAVE: Inicializamos como 'undefined', no como 'null'
    let padre: User | undefined = undefined; 

    if (createUserDto.emailReferido) {
      // Buscamos y si encontramos, asignamos. Si no, queda undefined.
      const padreEncontrado = await this.userRepository.findOne({ where: { email: createUserDto.emailReferido } });
      
      if (padreEncontrado) {
        padre = padreEncontrado;
      } else {
        // Opcional: avisar que no existe el referido
        console.warn(`Referido no encontrado: ${createUserDto.emailReferido}`);
      }
    }

    // 3. Hashear contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    // 4. Crear el usuario
    const newUser = this.userRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      nombre: createUserDto.nombre,
      role: createUserDto.role || UserRole.PRODUCTOR,
      
      // 👇 AGREGÁ ESTOS CAMPOS:
      dni: createUserDto.dni,
      telefono: createUserDto.telefono,
      matricula: createUserDto.matricula,
      
      referidoPor: padre || undefined,
    });

    return this.userRepository.save(newUser);
  }

  // (El resto de métodos los dejamos para después, para el admin)
  findAll() {
    return this.userRepository.find();
  }

  // ¡Vamos a necesitar este para el login!
  findOneByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  findOne(id: string) {
    return `This action returns a #${id} user`;
  }

  update(id: string, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: string) {
    return `This action removes a #${id} user`;
  }

  async findReferidos(padreId: string) {
    return this.userRepository.find({
      where: { 
        referidoPor: { id: padreId } // Buscamos los hijos de este padre
      },
      relations: ['reclamos_cargados'], // ¡Clave! Traemos sus reclamos para contarlos
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
        createdAt: true,
        // No traemos la password ni datos sensibles
      },
      order: {
        createdAt: 'DESC' // Los más nuevos arriba
      }
    });
  }
}