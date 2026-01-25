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
  // 1. CREATE (OPTIMIZADO CON PARALELISMO)
  // ----------------------------------------------------------------------
  // ----------------------------------------------------------------------
  // 1. CREATE (OPTIMIZADO CON PARALELISMO Y MÚLTIPLES ARCHIVOS)
  // ----------------------------------------------------------------------
  async create(dto: CreateReclamoDto, files: any) {

    // --- A. VALIDACIÓN LÓGICA ---
    // Nota: Verificamos que exista y tenga contenido
    if (!files.fileDNI || files.fileDNI.length === 0) throw new BadRequestException('Falta el DNI (frente y dorso).');

    const tieneSeguro = String(dto.tiene_seguro) === 'true';
    const hizoDenuncia = String(dto.hizo_denuncia) === 'true';
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
       // Si es Peatón / Acompañante
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

    // --- B. PREPARACIÓN PARA SUBIDA (Paralelismo) ---
    const { dni } = dto;
    const codigo_seguimiento = randomBytes(3).toString('hex').toUpperCase();
    const timestamp = Date.now();
    const firmaFile = (files.fileFirma && files.fileFirma.length > 0) ? files.fileFirma[0] : null;
    const firmaBuffer = firmaFile ? firmaFile.buffer : undefined; // Buffer para incrustar

    // Helper de subida individual
    const upload = async (file: Express.Multer.File, tag: string, index?: number) => {
      if (!file) return null;
      await this.validateFile(file);
      // Agregamos sufijo si viene índice para evitar colisión de nombres (ej: dni-1, dni-2)
      const sufijo = index !== undefined ? `-${index + 1}` : '';
      const nombre = `${dni}-${tag}-${timestamp}${sufijo}${extname(file.originalname)}`;
      return this.storageService.uploadFile(file, tag, nombre);
    };

    // Helper para archivos opcionales ÚNICOS (Poliza, Denuncia, etc.)
    const uploadSingle = (fileArray: any[], tag: string) => 
        (fileArray && fileArray.length > 0) ? upload(fileArray[0], tag) : Promise.resolve(null);

    // Helper para archivos MÚLTIPLES (DNI, Licencia, Cédula, Fotos, Complementaria)
    const uploadMultiple = (fileArray: any[], tag: string) => 
        (fileArray && fileArray.length > 0) 
          ? Promise.all(fileArray.map((f, i) => upload(f, tag, i))) 
          : Promise.resolve([]);

    // 🚀 EJECUCIÓN PARALELA DE TODAS LAS SUBIDAS
    const [
      path_dni,            // Array
      path_licencia,       // Array
      path_cedula,         // Array
      path_poliza_uploaded,
      path_denuncia,
      path_medicos,
      path_presupuesto,
      path_cbu_archivo,
      path_denuncia_penal,
      path_fotos_raw,      // Array
      path_firma_archivo,
      path_complementaria  // Array (NUEVO)
    ] = await Promise.all([
      uploadMultiple(files.fileDNI, 'dni'),           // <--- CAMBIO: Multiple
      uploadMultiple(files.fileLicencia, 'licencia'), // <--- CAMBIO: Multiple
      uploadMultiple(files.fileCedula, 'cedula'),     // <--- CAMBIO: Multiple
      uploadSingle(files.fileSeguro, 'poliza'),
      uploadSingle(files.fileDenuncia, 'denuncia'),
      uploadSingle(files.fileMedicos, 'medicos'),
      uploadSingle(files.filePresupuesto, 'presupuesto'),
      uploadSingle(files.fileCBU, 'cbu'),
      uploadSingle(files.fileDenunciaPenal, 'legal'),
      uploadMultiple(files.fileFotos, 'fotos'),       // <--- CAMBIO: Usa helper multiple
      uploadSingle(files.fileFirma, 'firmas'),
      uploadMultiple(files.fileComplementaria, 'complementaria') // <--- NUEVO CAMPO
    ]);

    // Limpieza de arrays (filtra nulos por seguridad)
    const cleanArray = (arr: any) => Array.isArray(arr) ? arr.filter(p => p !== null) : [];

    const path_fotos = cleanArray(path_fotos_raw);
    let path_poliza = path_poliza_uploaded;

    // --- C. GENERACIÓN Y SUBIDA DE PDFs AUTOMÁTICOS (Paralelismo) ---
    
    // 1. Promesa Representación
    const representacionTask = async () => {
        try {
            const pdfRep = await this.pdfService.generarRepresentacion({
                nombre: dto.nombre, dni: dto.dni, fecha: new Date().toLocaleDateString('es-AR'),
                firma: firmaBuffer
            });
            const fileRep: any = { buffer: pdfRep, originalname: 'representacion.pdf', mimetype: 'application/pdf', size: pdfRep.length };
            return await this.storageService.uploadFile(fileRep, 'legales', `${dto.dni}-representacion-${timestamp}.pdf`);
        } catch (e) { console.error('Error Rep:', e); return null; }
    };

    // 2. Promesa Honorarios
    const honorariosTask = async () => {
        try {
            const pdfHon = await this.pdfService.generarHonorarios({
                nombre: dto.nombre, dni: dto.dni, fecha: new Date().toLocaleDateString('es-AR'),
                firma: firmaBuffer 
            });
            const fileHon: any = { buffer: pdfHon, originalname: 'honorarios.pdf', mimetype: 'application/pdf', size: pdfHon.length };
            return await this.storageService.uploadFile(fileHon, 'legales', `${dto.dni}-honorarios-${timestamp}.pdf`);
        } catch (e) { console.error('Error Hon:', e); return null; }
    };

    // 3. Promesa Carta No Seguro (Condicional)
    const noSeguroTask = async () => {
        if (dto.rol_victima === 'Conductor' && !tieneSeguro) {
            try {
                const pdfBuffer = await this.pdfService.generarCartaNoSeguro({
                    nombre: dto.nombre, dni: dto.dni,
                    fecha: dto.fecha_hecho || new Date().toISOString().split('T')[0],
                    lugar: dto.lugar_hecho || 'No especificado', relato: dto.relato_hecho || '',
                    firma: firmaBuffer
                });
                const fakeFile: any = { buffer: pdfBuffer, originalname: `carta-no-seguro-${dto.dni}.pdf`, mimetype: 'application/pdf', size: pdfBuffer.length };
                return await this.storageService.uploadFile(fakeFile, 'legales', `${dto.dni}-carta-generada-${timestamp}.pdf`);
            } catch (e) { console.error('Error NoSeguro:', e); return null; }
        }
        return null;
    };

    // 🚀 EJECUCIÓN PARALELA DE PDFs
    const [path_representacion, path_honorarios, path_generado_noseguro] = await Promise.all([
        representacionTask(),
        honorariosTask(),
        noSeguroTask()
    ]);

    // Si se generó carta de no seguro, reemplaza a la póliza
    if (path_generado_noseguro) {
        path_poliza = path_generado_noseguro;
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
      hizo_denuncia: hizoDenuncia,
      sufrio_lesiones: sufrioLesiones,
      intervino_policia: intervinoPolicia,
      intervino_ambulancia: intervinoAmbulancia,

      codigo_seguimiento,
      estado: ReclamoEstado.ENVIADO,
      usuario_creador: productor, 
      
      // Paths Modificados (Cast a string[] para los arrays)
      path_dni: cleanArray(path_dni) as string[], 
      path_licencia: cleanArray(path_licencia) as string[],
      path_cedula: cleanArray(path_cedula) as string[],
      
      path_poliza: path_poliza || undefined,
      path_denuncia: path_denuncia || undefined,
      
      // Array de Fotos
      path_fotos: path_fotos.length > 0 ? (path_fotos as string[]) : undefined,
      
      // Archivos Únicos
      path_medicos: path_medicos || undefined,
      path_presupuesto: path_presupuesto || undefined,
      path_cbu_archivo: path_cbu_archivo || undefined,
      path_denuncia_penal: path_denuncia_penal || undefined,

      // Nuevo Campo Complementario (Array)
      path_complementaria: cleanArray(path_complementaria).length > 0 ? (cleanArray(path_complementaria) as string[]) : undefined,

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

    const urls = await Promise.all(paths.map(async (p) => {
      const url = await this.storageService.createSignedUrl(p) as any;
      return url?.url || url; 
    }));

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

  async consultarPorCodigo(codigo: string, dni: string) { 
    const reclamo = await this.reclamoRepository.findOne({ 
      where: { 
        codigo_seguimiento: codigo,
        dni: dni 
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
    const reclamo = await this.reclamoRepository.findOne({ 
        where: { id }, 
        relations: ['tramitador', 'usuario_creador', 'usuario_creador.referidoPor'] 
    });
    
    if (!reclamo) throw new NotFoundException('No encontrado');
    
    const estadoAnterior = reclamo.estado;

    Object.assign(reclamo, body);
    
    const actualizado = await this.reclamoRepository.save(reclamo);

    // 👇 AQUÍ ESTÁ LA MAGIA DE LA NOTIFICACIÓN DIFERENCIADA
    if (body.estado && body.estado !== estadoAnterior) {
        
        // 1. Notificar al CLIENTE (Asegurado)
        this.mailService.sendClientStatusUpdate(
            reclamo.email, 
            reclamo.nombre, 
            reclamo.estado, 
            reclamo.codigo_seguimiento
        ).catch(e => console.error('Error mail cliente:', e));

        // 2. Notificar al PRODUCTOR (Si existe)
        if (reclamo.usuario_creador) {
            this.mailService.sendProducerStatusUpdate(
                reclamo.usuario_creador.email, 
                reclamo.usuario_creador.nombre, // Nombre Productor
                reclamo.estado,
                reclamo.codigo_seguimiento,
                reclamo.nombre // Nombre Cliente (para que el productor sepa de quién hablan)
            ).catch(e => console.error('Error mail productor:', e));

            // 3. Notificar al BROKER (Si el productor tiene jefe)
            if (reclamo.usuario_creador.referidoPor) {
                this.mailService.sendBrokerStatusUpdate(
                    reclamo.usuario_creador.referidoPor.email, 
                    reclamo.usuario_creador.referidoPor.nombre, // Nombre Broker
                    reclamo.estado,
                    reclamo.codigo_seguimiento,
                    reclamo.usuario_creador.nombre, // "Tu productor X tuvo una novedad"
                    reclamo.nombre // Nombre Cliente
                ).catch(e => console.error('Error mail broker:', e));
            }
        }
    }
    
    return actualizado;
  }
  
  // ----------------------------------------------------------------------
  // BITÁCORA DE MENSAJES
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
      autor: 'Interno'
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
  // AGREGAMOS EL PARÁMETRO index CON VALOR POR DEFECTO 0
  async getArchivoUrl(reclamoId: string, tipoArchivo: string, index: number = 0) {
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
      'legal': 'path_denuncia_penal',
      'complementaria': 'path_complementaria' // Asegurate de agregar este
    };

    const columnaBd = mapaColumnas[tipoArchivo];
    if (!columnaBd) throw new BadRequestException(`El tipo de archivo '${tipoArchivo}' no es válido.`);

    const reclamo = await this.reclamoRepository.findOne({ where: { id: reclamoId } });
    if (!reclamo) throw new NotFoundException(`Reclamo con ID ${reclamoId} no encontrado`);

    const filePath = reclamo[columnaBd] as any;
    
    if (!filePath) throw new NotFoundException(`El archivo no existe para este reclamo.`);

    let targetPath: string;
    
    // SI ES ARRAY, USAMOS EL ÍNDICE QUE NOS PASARON
    if (Array.isArray(filePath)) {
        if (filePath.length === 0) throw new NotFoundException(`No hay archivos cargados.`);
        
        // Validación básica para que no rompa si piden un índice que no existe
        const i = (index >= 0 && index < filePath.length) ? index : 0;
        targetPath = filePath[i]; 
    } else {
        // Si es string (archivo único), ignoramos el índice
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
        // 1. Casos creados directamente por mí (Productor o Broker cargando personal)
        { usuario_creador: { id: userId } },
        
        // 2. Casos donde soy el Tramitador asignado (si aplica)
        { tramitador: { id: userId } },

        // 3. 👇 LA CLAVE: Casos creados por usuarios que me tienen como referente (Mis Productores)
        { usuario_creador: { referidoPor: { id: userId } } } 
      ],
      order: { fecha_creacion: 'DESC' },
      // Es vital traer la relación 'usuario_creador' para mostrar el nombre en el front
      relations: ['usuario_creador', 'tramitador'] 
    });
  }
}