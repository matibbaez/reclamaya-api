import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reclamo } from '../reclamos/entities/reclamo.entity';
import { User } from '../users/entities/user.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    @InjectRepository(Reclamo) private reclamoRepo: Repository<Reclamo>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private storageService: StorageService,
  ) {}

  // 👇 Todos los días a las 3:00 AM, hora Argentina (sin esto, Render corre en UTC)
  @Cron('0 3 * * *', { timeZone: 'America/Argentina/Buenos_Aires' })
  async hacerBackupDiario() {
    await this.ejecutarBackup();
  }

  // 👇 Lógica reutilizable: la llama tanto el cron como el endpoint manual
  async ejecutarBackup(): Promise<string> {
    this.logger.log('Iniciando backup...');

    const reclamos = await this.reclamoRepo.find({ relations: ['tramitador', 'usuario_creador'] });
    const usuarios = await this.userRepo.find(); // password no viene por select:false en la entidad

    const backup = {
      fecha: new Date().toISOString(),
      cantidad_reclamos: reclamos.length,
      cantidad_usuarios: usuarios.length,
      reclamos,
      usuarios,
    };

    const buffer = Buffer.from(JSON.stringify(backup, null, 2));
    const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    await this.storageService.uploadFile(
      { buffer, mimetype: 'application/json' } as any,
      'backups',
      fileName,
    );

    this.logger.log(`✅ Backup completado: ${fileName}`);
    return fileName;
  }
}