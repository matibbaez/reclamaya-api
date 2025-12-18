import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  private bucketName: string; // Añadimos esto para ser explícitos

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = configService.get<string>('SUPABASE_URL');
    // ¡CAMBIO AQUÍ! Usamos la clave de rol de servicio
    const supabaseServiceRoleKey = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucketName = configService.get<string>('SUPABASE_BUCKET_NAME')!; // Obtenemos el nombre del bucket

    if (!supabaseUrl || !supabaseServiceRoleKey || !this.bucketName) {
      throw new Error('Error: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SUPABASE_BUCKET_NAME no están definidas en el archivo .env');
    }

    // Creamos el cliente con la clave de servicio
    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    fileName: string,
  ) {
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await this.supabase.storage
      .from(this.bucketName) // Usamos la variable del bucket name
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      // Log más detallado para debug
      console.error('Error de Supabase al subir archivo:', error);
      throw new Error(`Error al subir archivo: ${error.message}`);
    }

    return data.path;
  }

  async createSignedUrl(filePath: string) {
    // console.log(`[StorageService] Generando link temporal para: ${filePath}`);
    
    // 1. Le pedimos a Supabase un link firmado (temporal)
    const { data, error } = await this.supabase.storage
      .from(this.bucketName) // 'reclamos'
      .createSignedUrl(filePath, 300); // <-- 300 segundos = 5 minutos de validez

    if (error) {
      console.error('Error al generar el link temporal:', error);
      throw new Error(`Error al generar link de Supabase: ${error.message}`);
    }

    // 2. Devolvemos la URL firmada
    // console.log(`[StorageService] Link generado: ${data.signedUrl}`);
    return data.signedUrl;
  }
}