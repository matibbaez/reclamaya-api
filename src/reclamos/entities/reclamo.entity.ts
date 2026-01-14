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

export interface MensajeReclamo {
  fecha: Date;
  texto: string;
  autor: string;
}

@Entity('reclamos')
export class Reclamo {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.reclamos_cargados, { nullable: true })
  @JoinColumn({ name: 'usuario_creador_id' })
  usuario_creador: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'tramitador_asignado_id' })
  tramitador: User | null;

  @Column() nombre: string;
  @Column() dni: string;
  @Column() email: string;
  @Column({ nullable: true }) telefono: string;
  @Column({ nullable: true }) domicilio_usuario: string; // Nuevo: Domicilio real (Paso 1)

  @Column({ unique: true }) codigo_seguimiento: string;

  @Column({
    type: 'enum',
    enum: ReclamoEstado,
    default: ReclamoEstado.ENVIADO
  })
  estado: ReclamoEstado; 

  @CreateDateColumn() fecha_creacion: Date;

  // --- CAMPOS DE TRÁNSITO ---
  @Column() rol_victima: string; 
  
  // Datos del Tercero (Ampliados para Paso 3)
  @Column({ nullable: true }) aseguradora_tercero: string;
  @Column({ nullable: true }) patente_tercero: string;
  @Column({ nullable: true }) tercero_nombre: string;       
  @Column({ nullable: true }) tercero_apellido: string;     
  @Column({ nullable: true }) tercero_dni: string;          
  @Column({ nullable: true }) tercero_marca_modelo: string; 

  @Column({ nullable: true }) patente_propia: string;
  @Column({ nullable: true, type: 'text' }) relato_hecho: string;
  
  @Column({ nullable: true }) fecha_hecho: string;
  @Column({ nullable: true }) hora_hecho: string;
  @Column({ nullable: true }) lugar_hecho: string;
  @Column({ nullable: true }) localidad: string; 
  @Column({ nullable: true }) provincia: string;
  @Column({ nullable: true }) cbu: string;       

  // --- PREGUNTAS CLAVE ---
  @Column({ default: true }) tiene_seguro: boolean;
  @Column({ default: false }) hizo_denuncia: boolean;
  @Column({ default: false }) in_itinere: boolean;
  @Column({ default: false }) posee_art: boolean;
  
  @Column({ default: false }) sufrio_lesiones: boolean;    
  @Column({ default: false }) intervino_policia: boolean;  
  @Column({ default: false }) intervino_ambulancia: boolean;

  // --- ARCHIVOS ---
  @Column() path_dni: string;
  @Column({ nullable: true }) path_licencia: string;
  @Column({ nullable: true }) path_cedula: string;
  @Column({ nullable: true }) path_poliza: string;
  @Column({ nullable: true }) path_denuncia: string;
  @Column("simple-array", { nullable: true }) path_fotos: string[];
  @Column({ nullable: true }) path_medicos: string;
  
  // Archivos Nuevos requeridos por PDF
  @Column({ nullable: true }) path_presupuesto: string;    
  @Column({ nullable: true }) path_cbu_archivo: string;    
  @Column({ nullable: true }) path_denuncia_penal: string; 

  @Column({ nullable: true }) path_representacion: string; 
  @Column({ nullable: true }) path_honorarios: string;

  @Column("simple-json", { nullable: true })
  mensajes: MensajeReclamo[];

  @Column("simple-json", { nullable: true })
  notas_internas: MensajeReclamo[];
}