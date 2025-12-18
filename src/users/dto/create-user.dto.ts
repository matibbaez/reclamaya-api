import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  nombre: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  // 👇 AGREGÁ ESTOS:
  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  matricula?: string;

  @IsOptional()
  @IsEmail()
  emailReferido?: string; // Para buscar al padre
}