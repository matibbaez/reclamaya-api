import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reclamo, ReclamoEstado, MensajeReclamo } from './entities/reclamo.entity';
import { CreateReclamoDto } from './dto/create-reclamo.dto';
import { StorageService } from 'src/storage/storage.service';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { MailService } from 'src/mail/mail.service';
import { PdfService } from 'src/common/pdf.service'; 
import { User, UserRole } from 'src/users/entities/user.entity';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
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

    const tieneSeguro = String(dto.tiene_seguro) === 'true';
    const inItinere = String(dto.in_itinere) === 'true'; 
    const poseeArt = String(dto.posee_art) === 'true'; 
    const sufrioLesiones = String(dto.sufrio_lesiones) === 'true';
    const intervinoPolicia = String(dto.intervino_policia) === 'true';
    const intervinoAmbulancia = String(dto.intervino_ambulancia) === 'true';

    // Validaciones de Rol
    if (dto.rol_victima === 'Conductor') {
       if (!files.fileLicencia) throw new BadRequestException('Falta Licencia de Conducir.');
       if (!files.fileCedula) throw new BadRequestException('Falta Cédula del vehículo.');
       
       if (tieneSeguro) {
          if (!files.fileSeguro) throw new BadRequestException('Falta Certificado de Cobertura.');
          if (!files.fileDenuncia) throw new BadRequestException('Falta Denuncia Administrativa.');
          if (!files.filePresupuesto) throw new BadRequestException('Falta Presupuesto o Carta de Franquicia.');
       } else {
          if (!dto.relato_hecho) throw new BadRequestException('Falta el relato de los hechos (para Carta No Seguro).');
          if (!dto.tercero_nombre || !dto.tercero_dni || !dto.tercero_marca_modelo) {
             throw new BadRequestException('Faltan datos del tercero (nombre, dni o vehículo).');
          }
       }
    } 
    else {
       if (!files.fileMedicos) throw new BadRequestException('Faltan certificados médicos o historia clínica.');
    }

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

    // Subida de archivos individuales
    const path_dni = await upload(files.fileDNI[0], 'dni');
    const path_licencia = await upload(files.fileLicencia?.[0], 'licencia');
    const path_cedula = await upload(files.fileCedula?.[0], 'cedula');
    let path_poliza = await upload(files.fileSeguro?.[0], 'poliza'); 
    const path_denuncia = await upload(files.fileDenuncia?.[0], 'denuncia');
    const path_medicos = await upload(files.fileMedicos?.[0], 'medicos');
    const path_presupuesto = await upload(files.filePresupuesto?.[0], 'presupuesto');
    const path_cbu_archivo = await upload(files.fileCBU?.[0], 'cbu');
    const path_denuncia_penal = await upload(files.fileDenunciaPenal?.[0], 'legal');

    // 👇 MANEJO DE MÚLTIPLES FOTOS
    let path_fotos: string[] = [];
    if (files.fileFotos && files.fileFotos.length > 0) {
        path_fotos = await Promise.all(
            files.fileFotos.map((f: Express.Multer.File) => upload(f, 'fotos'))
        );
        path_fotos = path_fotos.filter(p => p !== null) as string[];
    }

    // --- C. GENERACIÓN AUTOMÁTICA DE DOCUMENTOS ---
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
      domicilio_usuario: dto.domicilio_usuario,
      cbu: dto.cbu,
      
      // Datos Siniestro
      rol_victima: dto.rol_victima,
      aseguradora_tercero: dto.aseguradora_tercero,
      patente_tercero: dto.patente_tercero,
      patente_propia: dto.patente_propia,
      
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
      
      in_itinere: inItinere,
      posee_art: poseeArt,
      tiene_seguro: tieneSeguro,
      sufrio_lesiones: sufrioLesiones,
      intervino_policia: intervinoPolicia,
      intervino_ambulancia: intervinoAmbulancia,

      codigo_seguimiento,
      estado: ReclamoEstado.ENVIADO,
      usuario_creador: productor, 
      
      // Paths
      path_dni: path_dni!, 
      path_licencia: path_licencia || undefined,
      path_cedula: path_cedula || undefined,
      path_poliza: path_poliza || undefined,
      path_denuncia: path_denuncia || undefined,
      
      // Array de Fotos
      path_fotos: path_fotos.length > 0 ? path_fotos : undefined,
      
      path_medicos: path_medicos || undefined,
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
    
    if (reclamo.estado === ReclamoEstado.ENVIADO) {
      reclamo.estado = ReclamoEstado.RECEPCIONADO;
    }

    return this.reclamoRepository.save(reclamo);
  }

  async getGaleria(id: string) {
    const reclamo = await this.reclamoRepository.findOne({ where: { id } });
    if (!reclamo) throw new NotFoundException('Reclamo no encontrado');

    const paths = reclamo.path_fotos; 
    
    if (!paths || paths.length === 0) {
      return { urls: [] };
    }

    // Generamos las URLs. 'urls' será un array de textos: ['http...', 'http...']
    const urls = await Promise.all(paths.map(async (p) => {
      // Casteamos a 'any' por si tu StorageService tiene tipos estrictos que molestan
      const url = await this.storageService.createSignedUrl(p) as any;
      
      // Si por alguna razón tu servicio devuelve un objeto { url: '...' }, usalo.
      // Pero el error dice que devuelve string, así que devolvemos 'url' directo.
      return url?.url || url; 
    }));

    // CORRECCIÓN AQUÍ: Devolvemos el array directo
    return { urls }; 
  }

  // ----------------------------------------------------------------------
  // CONSULTAS Y UPDATES
  // ----------------------------------------------------------------------

  async findAll(estado?: string) {
    const where = estado ? { estado: estado as ReclamoEstado } : {};
    return this.reclamoRepository.find({ 
      where, 
      order: { fecha_creacion: 'DESC' },
      relations: ['usuario_creador', 'tramitador'] 
    });
  }

  async consultarPorCodigo(codigo: string, dni: string) { // 👈 Recibe DNI
    // Buscamos coincidencia exacta de AMBOS campos
    const reclamo = await this.reclamoRepository.findOne({ 
      where: { 
        codigo_seguimiento: codigo,
        dni: dni // 👈 Candado de seguridad
      } 
    });

    if (!reclamo) throw new NotFoundException('No se encontró un trámite con esos datos. Verificá el Código y tu DNI.');

    return { 
        codigo_seguimiento: reclamo.codigo_seguimiento, 
        estado: reclamo.estado, 
        fecha_creacion: reclamo.fecha_creacion,
        updatedAt: reclamo['updatedAt'] || null,
        nombre: reclamo.nombre,
        mensajes: reclamo.mensajes,
    };
  }

  async update(id: string, body: any) {
    const reclamo = await this.reclamoRepository.findOne({ where: { id }, relations: ['tramitador'] });
    if (!reclamo) throw new NotFoundException('No encontrado');
    
    // Update genérico de campos
    Object.assign(reclamo, body);

    // Si cambia estado, mandamos mail
    if (body.estado) {
        this.mailService.sendStatusUpdate(reclamo.email, reclamo.nombre, reclamo.estado).catch(console.error);
    }
    
    await this.reclamoRepository.save(reclamo);
    return reclamo;
  }

  // ----------------------------------------------------------------------
  // BITÁCORA DE MENSAJES (NUEVO)
  // ----------------------------------------------------------------------
  async agregarMensaje(id: string, texto: string) {
    const reclamo = await this.reclamoRepository.findOne({ where: { id }, relations: ['tramitador'] });
    if (!reclamo) throw new NotFoundException('Reclamo no encontrado');

    const nuevoMensaje: MensajeReclamo = {
      fecha: new Date(),
      texto: texto,
      autor: 'Estudio'
    };

    if (!reclamo.mensajes) {
      reclamo.mensajes = [nuevoMensaje];
    } else {
      reclamo.mensajes.push(nuevoMensaje);
    }

    return this.reclamoRepository.save(reclamo);
  }

  async agregarNotaInterna(id: string, texto: string) {
    const reclamo = await this.reclamoRepository.findOne({ where: { id } });
    if (!reclamo) throw new NotFoundException('Reclamo no encontrado');

    const nuevaNota: MensajeReclamo = {
      fecha: new Date(),
      texto: texto,
      autor: 'Interno' // O el nombre del usuario si lo tenés a mano
    };

    if (!reclamo.notas_internas) {
      reclamo.notas_internas = [nuevaNota];
    } else {
      reclamo.notas_internas.push(nuevaNota);
    }

    return this.reclamoRepository.save(reclamo);
  }

  // ----------------------------------------------------------------------
  // DESCARGA DE ARCHIVOS
  // ----------------------------------------------------------------------
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
      'presupuesto': 'path_presupuesto',
      'cbu': 'path_cbu_archivo',
      'legal': 'path_denuncia_penal'
    };

    const columnaBd = mapaColumnas[tipoArchivo];
    if (!columnaBd) throw new BadRequestException(`El tipo de archivo '${tipoArchivo}' no es válido.`);

    const reclamo = await this.reclamoRepository.findOne({ where: { id: reclamoId } });
    if (!reclamo) throw new NotFoundException(`Reclamo con ID ${reclamoId} no encontrado`);

    // 🔥 CORRECCIÓN: Casteamos a 'any' para evitar lío de tipos
    const filePath = reclamo[columnaBd] as any;
    
    if (!filePath) throw new NotFoundException(`El archivo no existe para este reclamo.`);

    let targetPath: string;
    if (Array.isArray(filePath)) {
        if (filePath.length === 0) throw new NotFoundException(`No hay fotos cargadas.`);
        targetPath = filePath[0]; 
    } else {
        targetPath = filePath as string;
    }

    return this.storageService.createSignedUrl(targetPath);
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