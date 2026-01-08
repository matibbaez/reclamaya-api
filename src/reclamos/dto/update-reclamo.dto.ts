import { PartialType } from '@nestjs/mapped-types';
import { CreateReclamoDto } from './create-reclamo.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateReclamoDto extends PartialType(CreateReclamoDto) {
  
  @IsOptional()
  @IsString()
  observaciones_publicas?: string;
  
  @IsOptional()
  @IsString()
  estado?: string;
}