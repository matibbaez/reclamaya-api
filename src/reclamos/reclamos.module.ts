import { Module } from '@nestjs/common';
import { ReclamosService } from './reclamos.service';
import { ReclamosController } from './reclamos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reclamo } from './entities/reclamo.entity';
import { StorageModule } from 'src/storage/storage.module';
import { MailModule } from 'src/mail/mail.module';
import { AuthModule } from 'src/auth/auth.module';
import { PdfService } from 'src/common/pdf.service';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reclamo, User]),
    StorageModule,
    MailModule,
    AuthModule
  ],
  controllers: [ReclamosController],
  providers: [
    ReclamosService,
    PdfService 
  ],
  exports: [ReclamosService]
})
export class ReclamosModule {}