import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    // Obtenemos las credenciales de R2 desde el .env
    const accountId = configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucketName = configService.get<string>('R2_BUCKET_NAME')!;

    // Validación estricta para no arrancar si falta config
    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucketName) {
      throw new Error('Error Crítico: Faltan variables de entorno de Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)');
    }

    // Inicializamos el cliente S3 apuntando a Cloudflare R2
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  // Mantenemos la misma firma que tenías antes
  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    fileName: string,
  ): Promise<string> {
    // Construimos el "Key" (ruta) del archivo: ej: "dni/123456-dni.jpg"
    const key = `${folder}/${fileName}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          // R2 encripta y guarda privado por defecto.
        }),
      );

      // Devolvemos el 'key' (el path) para que ReclamosService lo guarde en la BD.
      // Esto reemplaza al 'data.path' que devolvía Supabase.
      return key; 
    } catch (error: any) {
      this.logger.error(`Error subiendo archivo a R2: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error al subir archivo: ${error.message}`);
    }
  }

  // Mantenemos la misma firma
  async createSignedUrl(filePath: string): Promise<string> {
    try {
      // Creamos el comando para leer el archivo
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filePath, // filePath es lo que guardamos en la BD (ej: "dni/foto.jpg")
      });

      // Generamos la URL firmada.
      // Aumenté el tiempo a 1 hora (3600s) ya que R2 no cobra extra por esto y mejora la UX.
      const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      
      return url;
    } catch (error: any) {
      this.logger.error(`Error generando URL firmada R2 para ${filePath}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error al generar link: ${error.message}`);
    }
  }
}