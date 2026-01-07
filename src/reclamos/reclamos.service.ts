import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reclamo, ReclamoEstado } from './entities/reclamo.entity';
import { CreateReclamoDto } from './dto/create-reclamo.dto';
import { StorageService } from 'src/storage/storage.service';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { MailService } from 'src/mail/mail.service';
import { PdfService } from 'src/common/pdf.service'; 
import { User, UserRole } from 'src/users/entities/user.entity';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

@Injectable()
export class ReclamosService {

  constructor(
    @InjectRepository(Reclamo) private readonly reclamoRepository: Repository<Reclamo>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly storageService: StorageService,
    private readonly mailService: MailService,
    private readonly pdfService: PdfService,
  ) { }

  private async validateFile(file: Express.Multer.File) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Formato inválido: ${file.originalname}`);
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(`Archivo muy pesado: ${file.originalname}`);
    }
  }

  // ----------------------------------------------------------------------
  // 1. CREATE
  // ----------------------------------------------------------------------
  async create(dto: CreateReclamoDto, files: any) {

    // --- A. VALIDACIÓN LÓGICA ---
    if (!files.fileDNI) throw new BadRequestException('Falta el DNI (frente y dorso).');

    // Conversión de booleanos que vienen como string desde FormData
    const tieneSeguro = String(dto.tiene_seguro) === 'true';
    const inItinere = String(dto.in_itinere) === 'true'; 
    const poseeArt = String(dto.posee_art) === 'true'; 
    const sufrioLesiones = String(dto.sufrio_lesiones) === 'true';
    const intervinoPolicia = String(dto.intervino_policia) === 'true';
    const intervinoAmbulancia = String(dto.intervino_ambulancia) === 'true';

    // 1. Validación Rol: CONDUCTOR
    if (dto.rol_victima === 'Conductor') {
       if (!files.fileLicencia) throw new BadRequestException('Falta Licencia de Conducir.');
       if (!files.fileCedula) throw new BadRequestException('Falta Cédula del vehículo.');
       
       if (tieneSeguro) {
          if (!files.fileSeguro) throw new BadRequestException('Falta Certificado de Cobertura.');
          if (!files.fileDenuncia) throw new BadRequestException('Falta Denuncia Administrativa.');
          // PDF: Presupuesto o carta de franquicia obligatorio si tiene seguro
          if (!files.filePresupuesto) throw new BadRequestException('Falta Presupuesto o Carta de Franquicia.');
       } else {
          // Si NO tiene seguro
          if (!dto.relato_hecho) throw new BadRequestException('Falta el relato de los hechos (para Carta No Seguro).');
          // PDF: Datos del tercero obligatorios
          if (!dto.tercero_nombre || !dto.tercero_dni || !dto.tercero_marca_modelo) {
             throw new BadRequestException('Faltan datos del tercero (nombre, dni o vehículo).');
          }
       }
    } 
    // 2. Validación Rol: PEATÓN O ACOMPAÑANTE
    else {
       // Por lo general implican lesiones, pedimos médicos
       if (!files.fileMedicos) throw new BadRequestException('Faltan certificados médicos o historia clínica.');
       // PDF: Pide denuncia penal si existe (opcional en validación estricta, pero ideal tenerlo)
    }

    // 3. Validación Global: SI SUFRIÓ LESIONES
    if (sufrioLesiones && !files.fileMedicos) {
        throw new BadRequestException('Indicó que sufrió lesiones pero no subió certificados médicos.');
    }

    // --- LÓGICA DE REFERIDOS ---
    let productor: User | undefined; 
    if (dto.codigo_ref) {
      try {
        productor = await this.userRepository.findOne({ where: { id: dto.codigo_ref } }) || undefined; 
      } catch (error) {
        console.warn('⚠️ Código de referido inválido:', dto.codigo_ref);
      }
    }

    // --- B. SUBIDA DE ARCHIVOS ---
    const { dni } = dto;
    const codigo_seguimiento = randomBytes(3).toString('hex').toUpperCase();
    const timestamp = Date.now();

    const upload = async (file: Express.Multer.File, tag: string) => {
      if (!file) return null;
      await this.validateFile(file);
      const nombre = `${dni}-${tag}-${timestamp}${extname(file.originalname)}`;
      return this.storageService.uploadFile(file, tag, nombre);
    };

    // Archivos Estándar
    const path_dni = await upload(files.fileDNI[0], 'dni');
    const path_licencia = await upload(files.fileLicencia?.[0], 'licencia');
    const path_cedula = await upload(files.fileCedula?.[0], 'cedula');
    let path_poliza = await upload(files.fileSeguro?.[0], 'poliza'); 
    const path_denuncia = await upload(files.fileDenuncia?.[0], 'denuncia');
    const path_fotos = await upload(files.fileFotos?.[0], 'fotos');
    const path_medicos = await upload(files.fileMedicos?.[0], 'medicos');

    // Archivos Nuevos (PDF Requerimientos)
    const path_presupuesto = await upload(files.filePresupuesto?.[0], 'presupuesto');
    const path_cbu_archivo = await upload(files.fileCBU?.[0], 'cbu');
    const path_denuncia_penal = await upload(files.fileDenunciaPenal?.[0], 'legal');

    // --- C. GENERACIÓN AUTOMÁTICA DE DOCUMENTOS ---
    
    // 1. Representación
    let path_representacion: string | null = null; 
    try {
      const pdfRep = await this.pdfService.generarRepresentacion({
        nombre: dto.nombre,
        dni: dto.dni,
        fecha: new Date().toLocaleDateString('es-AR')
      });
      const fileRep: any = { buffer: pdfRep, originalname: 'representacion.pdf', mimetype: 'application/pdf', size: pdfRep.length };
      path_representacion = await this.storageService.uploadFile(fileRep, 'legales', `${dto.dni}-representacion-${timestamp}.pdf`);
    } catch (e) { 
        console.error('Error generando Representación:', e); 
    }

    // 2. Honorarios
    let path_honorarios: string | null = null;
    try {
      const pdfHon = await this.pdfService.generarHonorarios({
        nombre: dto.nombre,
        dni: dto.dni,
        fecha: new Date().toLocaleDateString('es-AR')
      });
      const fileHon: any = { buffer: pdfHon, originalname: 'honorarios.pdf', mimetype: 'application/pdf', size: pdfHon.length };
      path_honorarios = await this.storageService.uploadFile(fileHon, 'legales', `${dto.dni}-honorarios-${timestamp}.pdf`);
    } catch (e) { 
        console.error('Error generando Honorarios:', e); 
    }

    // 3. Carta No Seguro (Solo si es conductor sin seguro)
    if (dto.rol_victima === 'Conductor' && !tieneSeguro) {
      try {
        const pdfBuffer = await this.pdfService.generarCartaNoSeguro({
          nombre: dto.nombre,
          dni: dto.dni,
          fecha: dto.fecha_hecho || new Date().toISOString().split('T')[0],
          lugar: dto.lugar_hecho || 'No especificado',
          relato: dto.relato_hecho || ''
        });

        const fakeFile: any = {
          buffer: pdfBuffer,
          originalname: `carta-no-seguro-${dto.dni}.pdf`,
          mimetype: 'application/pdf',
          size: pdfBuffer.length
        };

        const path_generado = await this.storageService.uploadFile(fakeFile, 'legales', `${dto.dni}-carta-generada-${timestamp}.pdf`);
        // Usamos el slot de póliza para guardar la carta de no seguro, o podrías crear un campo nuevo
        path_poliza = path_generado; 

      } catch (error) {
        console.error('Error generando PDF No Seguro:', error);
      }
    }

    // --- D. GUARDAR EN BD ---
    const nuevoReclamo = this.reclamoRepository.create({
      // Datos Personales
      nombre: dto.nombre,
      dni: dto.dni,
      email: dto.email,
      telefono: dto.telefono,
      domicilio_usuario: dto.domicilio_usuario, // Nuevo campo
      cbu: dto.cbu,
      
      // Datos Siniestro
      rol_victima: dto.rol_victima,
      aseguradora_tercero: dto.aseguradora_tercero,
      patente_tercero: dto.patente_tercero,
      patente_propia: dto.patente_propia,
      
      // Datos Tercero (Nuevos campos)
      tercero_nombre: dto.tercero_nombre,
      tercero_apellido: dto.tercero_apellido,
      tercero_dni: dto.tercero_dni,
      tercero_marca_modelo: dto.tercero_marca_modelo,

      relato_hecho: dto.relato_hecho,
      hora_hecho: dto.hora_hecho,
      fecha_hecho: dto.fecha_hecho,
      lugar_hecho: dto.lugar_hecho,
      localidad: dto.localidad,
      provincia: dto.provincia,
      
      // Booleanos
      in_itinere: inItinere,
      posee_art: poseeArt,
      tiene_seguro: tieneSeguro,
      sufrio_lesiones: sufrioLesiones,         // Nuevo
      intervino_policia: intervinoPolicia,     // Nuevo
      intervino_ambulancia: intervinoAmbulancia, // Nuevo

      codigo_seguimiento,
      estado: ReclamoEstado.ENVIADO,
      usuario_creador: productor, 
      
      // Paths Archivos
      path_dni: path_dni!, 
      path_licencia: path_licencia || undefined,
      path_cedula: path_cedula || undefined,
      path_poliza: path_poliza || undefined,
      path_denuncia: path_denuncia || undefined,
      path_fotos: path_fotos || undefined,
      path_medicos: path_medicos || undefined,
      
      // Paths Nuevos
      path_presupuesto: path_presupuesto || undefined,
      path_cbu_archivo: path_cbu_archivo || undefined,
      path_denuncia_penal: path_denuncia_penal || undefined,

      path_representacion: path_representacion || undefined,
      path_honorarios: path_honorarios || undefined
    });

    await this.reclamoRepository.save(nuevoReclamo);

    // --- E. EMAILS ---
    this.mailService.sendNewReclamoClient(dto.email, dto.nombre, codigo_seguimiento).catch(console.error);
    
    this.mailService.sendNewReclamoAdmin({
      nombre: dto.nombre,
      dni: dto.dni,
      codigo_seguimiento,
      tipo: dto.rol_victima 
    }).catch(console.error);

    return { message: '¡Éxito!', codigo_seguimiento };
  }

  // ----------------------------------------------------------------------
  // ASIGNAR TRAMITADOR
  // ----------------------------------------------------------------------
  async asignarTramitador(reclamoId: string, tramitadorId: string) {
    const reclamo = await this.reclamoRepository.findOne({ where: { id: reclamoId } });
    if (!reclamo) throw new NotFoundException('Reclamo no encontrado');

    const tramitador = await this.userRepository.findOne({ where: { id: tramitadorId } });
    if (!tramitador) throw new NotFoundException('Usuario no encontrado');

    const rolesValidos = [UserRole.ADMIN, UserRole.TRAMITADOR];
    if (!rolesValidos.includes(tramitador.role as UserRole)) {
        throw new BadRequestException(`El usuario ${tramitador.nombre} no tiene permisos para gestionar reclamos.`);
    }

    reclamo.tramitador = tramitador;
    
    // Avanzar estado si estaba solo en enviado
    if (reclamo.estado === ReclamoEstado.ENVIADO) {
      reclamo.estado = ReclamoEstado.RECEPCIONADO;
    }

    return this.reclamoRepository.save(reclamo);
  }

  // ----------------------------------------------------------------------
  // OTROS MÉTODOS
  // ----------------------------------------------------------------------

  async findAll(estado?: string) {
    const where = estado ? { estado: estado as ReclamoEstado } : {};
    return this.reclamoRepository.find({ 
      where, 
      order: { fecha_creacion: 'DESC' },
      relations: ['usuario_creador', 'tramitador'] 
    });
  }

  async consultarPorCodigo(codigo: string) {
    const reclamo = await this.reclamoRepository.findOne({ where: { codigo_seguimiento: codigo } });
    if (!reclamo) throw new NotFoundException('Código no encontrado');
    return { 
        codigo_seguimiento: reclamo.codigo_seguimiento, 
        estado: reclamo.estado, 
        fecha_creacion: reclamo.fecha_creacion,
        nombre: reclamo.nombre 
    };
  }

  async update(id: string, body: any) {
    const reclamo = await this.reclamoRepository.findOne({ where: { id } });
    if (!reclamo) throw new NotFoundException('No encontrado');
    
    if (body.estado) {
        reclamo.estado = body.estado as ReclamoEstado;
        this.mailService.sendStatusUpdate(reclamo.email, reclamo.nombre, reclamo.estado).catch(console.error);
    }
    // Aquí podrías agregar lógica para actualizar otros campos si fuera necesario
    
    await this.reclamoRepository.save(reclamo);
    return reclamo;
  }

  async getArchivoUrl(reclamoId: string, tipoArchivo: string) {
    const mapaColumnas: Record<string, keyof Reclamo> = {
      'dni': 'path_dni',
      'licencia': 'path_licencia',
      'cedula': 'path_cedula',
      'poliza': 'path_poliza',
      'denuncia': 'path_denuncia',
      'fotos': 'path_fotos',
      'medicos': 'path_medicos',
      'representacion': 'path_representacion',
      'honorarios': 'path_honorarios',
      
      // Nuevos Mapeos
      'presupuesto': 'path_presupuesto',
      'cbu': 'path_cbu_archivo',
      'legal': 'path_denuncia_penal'
    };

    const columnaBd = mapaColumnas[tipoArchivo];
    if (!columnaBd) throw new BadRequestException(`El tipo de archivo '${tipoArchivo}' no es válido.`);

    const reclamo = await this.reclamoRepository.findOne({ where: { id: reclamoId } });
    if (!reclamo) throw new NotFoundException(`Reclamo con ID ${reclamoId} no encontrado`);

    const filePath = reclamo[columnaBd] as string;
    if (!filePath) throw new NotFoundException(`El archivo no existe para este reclamo.`);

    return this.storageService.createSignedUrl(filePath);
  }

  async findOne(id: string) { 
    const reclamo = await this.reclamoRepository.findOne({ 
      where: { id },
      relations: ['usuario_creador', 'tramitador'] 
    }); 

    if (!reclamo) throw new NotFoundException('Reclamo no encontrado');
    return reclamo;
  }

  remove(id: string) { return this.reclamoRepository.delete(id); }

  async findAllByUser(userId: string) {
    return this.reclamoRepository.find({
      where: [
        { usuario_creador: { id: userId } },
        { tramitador: { id: userId } }
      ],
      order: { fecha_creacion: 'DESC' },
      relations: ['usuario_creador', 'tramitador'] 
    });
  }
}