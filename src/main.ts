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
  
  app.enableCors({
    origin: [
      'https://reclamaya.ar', 
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4200' 
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  // 1. AUMENTAR EL LÍMITE DE SUBIDA
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

  // 2. ACTIVAR SEGURIDAD
  app.use(helmet()); 
  

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

  // --- 💡 LÓGICA KEEP-ALIVE PARA SUPABASE (VÍA API REST) ---
  // Esta función hace una petición HTTP cada 1 hora para que Supabase registre actividad real
  setInterval(async () => {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });
        
        if (response.ok) {
          console.log('✨ Keep-alive: Ping HTTP exitoso a la API de Supabase.');
        } else {
          console.error('❌ Keep-alive: Supabase respondió con error:', response.statusText);
        }
      } else {
        console.warn('⚠️ Keep-alive: Faltan variables de Supabase en el .env');
      }
    } catch (e) {
      const error = e as Error;
      console.error('❌ Error en el Keep-alive de Supabase:', error.message);
    }
  }, 1000 * 60 * 60); // Ejecutar cada 1 hora
}
bootstrap();