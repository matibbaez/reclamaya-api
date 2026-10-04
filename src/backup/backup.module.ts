import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { Reclamo } from '../reclamos/entities/reclamo.entity';
import { User } from '../users/entities/user.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reclamo, User]),
    StorageModule,
  ],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}