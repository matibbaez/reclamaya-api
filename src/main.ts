import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { User, UserRole } from './users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import helmet from 'helmet'; // 1. IMPORTAR HELMET

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 2. ACTIVAR SEGURIDAD
  app.use(helmet()); 
  app.enableCors(); // En producción (origin: 'https://reclamaya.com.ar')

  // 3. VALIDACIÓN ESTRICTA (Fundamental para evitar inyecciones de datos raros)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Elimina propiedades que no estén en el DTO
    forbidNonWhitelisted: true, // Tira error si mandan algo extra
    transform: true // Convierte tipos automáticamente (ej. string '10' a number 10)
  }));

  // --- SEED ADMIN (Esto lo dejamos igual) ---
  const usersRepository = app.get(getRepositoryToken(User));
  const adminEmail = 'admin@estudio.com';
  
  const admin = await usersRepository.findOne({ where: { email: adminEmail } });

  if (!admin) {
    console.log('¡Admin no encontrado! Creando usuario admin...');
    const password = await bcrypt.hash('PasswordSeguro123!', 10);
    
    const newAdmin = usersRepository.create({
      nombre: 'Admin Estudio',
      email: adminEmail,
      password,
      role: UserRole.ADMIN,
      dni: '00000000',
      telefono: '0000000000',
      referidoPor: null
    });

    await usersRepository.save(newAdmin);
    console.log('✅ Admin creado con éxito');
  }
  // ----------------------------------

  await app.listen(3000);
}
bootstrap();