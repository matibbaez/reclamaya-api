import {
  IsString, IsEmail, IsNotEmpty, MinLength, MaxLength, Matches,
  IsNumberString, IsOptional, IsBooleanString,
} from 'class-validator';

export class CreateReclamoDto {
  
  // --- DATOS PERSONALES ---
  @IsString() @IsNotEmpty() @MinLength(3)
  nombre: string;

  @IsNotEmpty() @IsNumberString() @MinLength(7) @MaxLength(8)
  dni: string;

  @IsEmail() @IsNotEmpty()
  email: string;

  @IsString() @IsNotEmpty()
  telefono: string;

  @IsString() @IsNotEmpty()
  domicilio_usuario: string; // Nuevo: Domicilio real

  @IsString() @IsNotEmpty()
  rol_victima: string; // 'Conductor', 'Acompanante', 'Peaton'

  // --- DATOS DEL SINIESTRO / TERCERO ---
  @IsOptional() @IsString() codigo_ref?: string;
  @IsOptional() @IsString() aseguradora_tercero?: string;
  @IsOptional() @IsString() patente_tercero?: string;
  @IsOptional() @IsString() tercero_nombre?: string;       // Nuevo
  @IsOptional() @IsString() tercero_apellido?: string;     // Nuevo
  @IsOptional() @IsString() tercero_dni?: string;          // Nuevo
  @IsOptional() @IsString() tercero_marca_modelo?: string; // Nuevo

  @IsOptional() @IsString() patente_propia?: string;
  @IsOptional() @IsString() relato_hecho?: string;

  // --- FECHA Y LUGAR ---
  @IsOptional() @IsString() fecha_hecho?: string;
  @IsOptional() @IsString() hora_hecho?: string; 
  @IsOptional() @IsString() lugar_hecho?: string;
  @IsOptional() @IsString() localidad?: string;
  @IsOptional() @IsString() provincia?: string;

  // --- BOOLEANOS (Vienen como string 'true'/'false' del FormData) ---
  @IsOptional() @IsBooleanString() tiene_seguro?: string; 
  @IsOptional() @IsBooleanString() hizo_denuncia?: string;
  @IsOptional() @IsBooleanString() in_itinere?: string;
  @IsOptional() @IsBooleanString() posee_art?: string;
  
  @IsOptional() @IsBooleanString() sufrio_lesiones?: string;    // Nuevo
  @IsOptional() @IsBooleanString() intervino_policia?: string;  // Nuevo
  @IsOptional() @IsBooleanString() intervino_ambulancia?: string; // Nuevo

  @IsOptional() @IsString() cbu?: string;
}