import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReclamoEstado {
  ENVIADO = 'Enviado',
  RECEPCIONADO = 'Recepcionado',
  INICIADO = 'Iniciado',
  NEGOCIACION = 'Negociacion',
  INDEMNIZANDO = 'Indemnizando',
  INDEMNIZADO = 'Indemnizado',
  RECHAZADO = 'Rechazado',
}

@Entity('reclamos')
export class Reclamo {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.reclamos_cargados, { nullable: true })
  @JoinColumn({ name: 'usuario_creador_id' })
  usuario_creador: User;

  @Column() nombre: string;
  @Column() dni: string;
  @Column() email: string;
  @Column({ unique: true }) codigo_seguimiento: string;
  @Column({ nullable: true }) telefono: string;

  @Column({
    type: 'enum',
    enum: ReclamoEstado,
    default: ReclamoEstado.ENVIADO
  })
  estado: ReclamoEstado; 

  @CreateDateColumn() fecha_creacion: Date;

  // --- NUEVOS CAMPOS DE TRÁNSITO ---
  @Column() rol_victima: string; // Conductor, Acompanante, Peaton
  
  @Column({ nullable: true }) aseguradora_tercero: string;
  @Column({ nullable: true }) patente_tercero: string;
  @Column({ nullable: true }) patente_propia: string;
  @Column({ nullable: true, type: 'text' }) relato_hecho: string;
  
  @Column({ nullable: true }) fecha_hecho: string;
  @Column({ nullable: true }) lugar_hecho: string;
  @Column({ nullable: true }) localidad: string;

  // --- NUEVOS ARCHIVOS ---
  @Column() path_dni: string;
  
  @Column({ nullable: true }) path_licencia: string;
  @Column({ nullable: true }) path_cedula: string;
  @Column({ nullable: true }) path_poliza: string;
  @Column({ nullable: true }) path_denuncia: string;
  @Column({ nullable: true }) path_fotos: string;
  @Column({ nullable: true }) path_medicos: string;
}