import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsNumberString,
  IsOptional,
  IsBooleanString,
} from 'class-validator';

export class CreateReclamoDto {
  
  // --- DATOS PERSONALES (VALIDACIÓN FUERTE) ---
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/, {
    message: 'El nombre solo puede contener letras y espacios',
  })
  nombre: string;

  @IsNotEmpty()
  @IsNumberString({}, { message: 'El DNI solo puede contener números' })
  @MinLength(7)
  @MaxLength(8)
  dni: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  telefono: string; // Agregá esto

  // --- EL NUEVO "TIPO DE TRÁMITE" ---
  // Importante: En el Frontend asegurate de enviar este dato con la key 'rol_victima'
  @IsString()
  @IsNotEmpty()
  rol_victima: string; // 'Conductor', 'Acompanante', 'Peaton'

  // --- DATOS DEL SINIESTRO (OPCIONALES EN DTO, OBLIGATORIOS EN SERVICE SEGÚN ROL) ---
  
  @IsOptional()
  @IsString()
  codigo_ref?: string;

  @IsOptional()
  @IsString()
  aseguradora_tercero?: string;

  @IsOptional()
  @IsString()
  patente_tercero?: string;

  @IsOptional()
  @IsString()
  patente_propia?: string;

  @IsOptional()
  @IsString()
  relato_hecho?: string;

  // --- DATOS DE FECHA Y LUGAR ---
  
  @IsOptional()
  @IsString()
  fecha_hecho?: string;

  // (Recibimos la hora como string '14:30')
  @IsOptional()
  @IsString()
  hora_hecho?: string; 

  @IsOptional()
  @IsString()
  lugar_hecho?: string;

  @IsOptional()
  @IsString()
  localidad?: string;

  // --- SWITCH DE SEGURO ---
  // Viene como 'true'/'false' string desde el FormData
  @IsOptional()
  @IsBooleanString()
  tiene_seguro?: string; 
}