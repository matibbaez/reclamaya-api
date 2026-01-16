import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { User, UserRole } from './users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import helmet from 'helmet';
import { json, urlencoded } from 'express'; // 👈 IMPORTANTE: Agregar esto

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 1. AUMENTAR EL LÍMITE DE SUBIDA (Para fotos y firma)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 2. ACTIVAR SEGURIDAD
  app.use(helmet()); 
  
  // 3. Habilitar CORS (Vital para que tu Frontend hable con el Back)
  app.enableCors(); 

  // 4. VALIDACIÓN ESTRICTA
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }));

  // --- SEED ADMIN (Lógica original) ---
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
      referidoPor: null // null es válido aquí porque es admin raíz
    });

    await usersRepository.save(newAdmin);
    console.log('✅ Admin creado con éxito');
  }
  // ----------------------------------

  // 👇 CONFIGURACIÓN RENDER
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
}
bootstrap();