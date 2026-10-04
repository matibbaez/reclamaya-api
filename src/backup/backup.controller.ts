import { Controller, Post, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupService } from './backup.service';

@Controller('backup')
export class BackupController {
  constructor(private backupService: BackupService) {}

  @UseGuards(JwtAuthGuard)
  @Post('manual')
  async dispararManual(@Request() req) {
    if (req.user?.role !== 'Admin') {
      throw new UnauthorizedException('Solo un administrador puede disparar un backup manual.');
    }
    const fileName = await this.backupService.ejecutarBackup();
    return { message: 'Backup generado correctamente', fileName };
  }
}