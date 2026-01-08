import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { User, UserRole } from './users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 1. ACTIVAR SEGURIDAD
  app.use(helmet()); 
  
  // Habilitar CORS (Vital para que tu Frontend en Hostinger pueda hablar con el Back)
  app.enableCors(); 

  // 2. VALIDACIÓN ESTRICTA
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }));

  // --- SEED ADMIN (Mantenemos tu lógica original) ---
  const usersRepository = app.get(getRepositoryToken(User));
  const adminEmail = 'admin@estudio.com'; // ⚠️ Asegurate de cambiar la pass luego
  
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

  // 👇 EL CAMBIO PARA RENDER:
  // Usamos process.env.PORT si existe (Render lo inyecta), sino 3000 (Local).
  // '0.0.0.0' es obligatorio para que Docker/Render expongan el puerto.
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
}
bootstrap();