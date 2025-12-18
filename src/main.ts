import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { User, UserRole } from './users/entities/user.entity'; // Importá UserRole
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // ... (configuraciones de CORS y Pipes) ...
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());

  // --- ACÁ ESTÁ EL SEED DEL ADMIN ---
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
      role: UserRole.ADMIN, // Asegurate que sea ADMIN
      
      // --- AGREGÁ ESTAS DOS LÍNEAS ---
      dni: '00000000',       // Un DNI ficticio para el Admin
      telefono: '0000000000', // Un teléfono ficticio
      // -------------------------------
      
      referidoPor: null
    });

    await usersRepository.save(newAdmin);
    console.log('✅ Admin creado con éxito');
  }
  // ----------------------------------

  await app.listen(3000);
}
bootstrap();