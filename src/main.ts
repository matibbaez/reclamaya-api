import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { User, UserRole } from './users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 1. AUMENTAR EL LÍMITE DE SUBIDA
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 2. ACTIVAR SEGURIDAD
  app.use(helmet()); 
  
  // 3. HABILITAR CORS
  app.enableCors(); 

  // 4. VALIDACIÓN ESTRICTA
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }));

  // --- REPOSITORIO DE USUARIOS ---
  const usersRepository = app.get(getRepositoryToken(User));

  // --- SEED ADMIN ---
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

  // --- CONFIGURACIÓN RENDER ---
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);

  // --- 💡 LÓGICA KEEP-ALIVE PARA SUPABASE ---
  // Esta función hace una consulta simple cada 1 hora para evitar la pausa del proyecto
  setInterval(async () => {
    try {
      // SELECT 1 es la consulta más ligera posible en Postgres
      await usersRepository.query('SELECT 1');
      console.log('✨ Keep-alive: Supabase detectó actividad.');
    } catch (e) {
      console.error('❌ Keep-alive error:', e.message);
    }
  }, 1000 * 60 * 60); // Ejecutar cada 1 hora
}
bootstrap();