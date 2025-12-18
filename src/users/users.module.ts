import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm'; // 1. Importar
import { User } from './entities/user.entity'; // 2. Importar

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // 3. ¡Conectar el molde!
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // 4. ¡EXPORTAMOS el servicio para el Login!
})
export class UsersModule {}