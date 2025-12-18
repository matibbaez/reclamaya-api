import { IsNotEmpty, IsString, IsEmail, MinLength, IsOptional } from 'class-validator';

export class RegisterAuthDto {
    @IsNotEmpty()
    @IsString()
    nombre: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
    password: string;

    @IsNotEmpty()
    @IsString()
    dni: string;

    @IsNotEmpty()
    @IsString()
    telefono: string;

    // --- EL CAMPO MÁGICO PARA REFERIDOS ---
    @IsOptional()
    @IsString()
    referralCode?: string; // Acá va a venir el ID del Broker que invita
}