import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Reclamo } from '../../reclamos/entities/reclamo.entity';

export enum UserRole {
  ADMIN = 'Admin',
  TRAMITADOR = 'Tramitador',
  PRODUCTOR = 'Productor',
  ORGANIZADOR = 'Organizador' 
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // Hash

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PRODUCTOR,
  })
  role: string;

  @Column({ nullable: true }) 
  dni: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  matricula: string;

  // FECHA DE CREACIÓN
  @CreateDateColumn()
  createdAt: Date;

  // RELACIÓN: Referido Por (Padre)
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'referido_por_id' })
  referidoPor: User | null;

  // RELACIÓN: Mis Reclamos (Si soy Productor)
  @OneToMany(() => Reclamo, (reclamo) => reclamo.usuario_creador)
  reclamos_cargados: Reclamo[];
}