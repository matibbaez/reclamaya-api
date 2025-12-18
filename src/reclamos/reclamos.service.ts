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
import { User } from 'src/users/entities/user.entity';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

@Injectable()
export class ReclamosService {

  constructor(
    @InjectRepository(Reclamo) private readonly reclamoRepository: Repository<Reclamo>,
    // Inyectamos el repo de usuarios para buscar referidos
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
  // 1. CREATE (Con lógica de Referidos)
  // ----------------------------------------------------------------------
  async create(dto: CreateReclamoDto, files: any) {

    // --- A. VALIDACIÓN LÓGICA ---
    if (!files.fileDNI) throw new BadRequestException('Falta el DNI.');

    // Convertimos el string 'true'/'false' a booleano real
    const tieneSeguro = String(dto.tiene_seguro) === 'true';

    // Caso: CONDUCTOR
    if (dto.rol_victima === 'Conductor') {
       if (!files.fileLicencia) throw new BadRequestException('Falta Licencia de Conducir.');
       if (!files.fileCedula) throw new BadRequestException('Falta Cédula del vehículo.');
       
       if (tieneSeguro) {
          if (!files.fileSeguro) throw new BadRequestException('Falta Certificado de Cobertura.');
          if (!files.fileDenuncia) throw new BadRequestException('Falta Denuncia Administrativa.');
       } else {
          // Si NO tiene seguro, es obligatorio el relato para generar la carta
          if (!dto.relato_hecho) throw new BadRequestException('Falta el relato de los hechos (Carta No Seguro).');
       }
    } 
    // Caso: PEATÓN O ACOMPAÑANTE
    else {
       if (!files.fileMedicos) throw new BadRequestException('Faltan certificados médicos o historia clínica.');
    }

    // --- 🔍 LÓGICA DE REFERIDOS (NUEVO) ---
    // Buscamos si existe un productor con el ID que viene en codigo_ref
    let productor: User | undefined; 

    if (dto.codigo_ref) {
      try {
        productor = await this.userRepository.findOne({ where: { id: dto.codigo_ref } }) || undefined; // El || undefined asegura que si no encuentra, no sea null
        if (productor) {
          console.log(`✅ Referido asignado: ${productor.email}`);
        }
      } catch (error) {
        console.warn('⚠️ Código de referido inválido o error al buscar:', dto.codigo_ref);
      }
    }

    // --- B. SUBIDA DE ARCHIVOS NORMALES ---
    const { dni } = dto;
    const codigo_seguimiento = randomBytes(3).toString('hex').toUpperCase();
    const timestamp = Date.now();

    const upload = async (file: Express.Multer.File, tag: string) => {
      if (!file) return null;
      await this.validateFile(file);
      const nombre = `${dni}-${tag}-${timestamp}${extname(file.originalname)}`;
      return this.storageService.uploadFile(file, tag, nombre);
    };

    const path_dni = await upload(files.fileDNI[0], 'dni');
    const path_licencia = await upload(files.fileLicencia?.[0], 'licencia');
    const path_cedula = await upload(files.fileCedula?.[0], 'cedula');
    let path_poliza = await upload(files.fileSeguro?.[0], 'poliza'); // Puede ser null
    const path_denuncia = await upload(files.fileDenuncia?.[0], 'denuncia');
    const path_fotos = await upload(files.fileFotos?.[0], 'fotos');
    const path_medicos = await upload(files.fileMedicos?.[0], 'medicos');

    // --- C. GENERACIÓN AUTOMÁTICA DE CARTA DE NO SEGURO ---
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

        const nombreArchivo = `${dto.dni}-carta-generada-${timestamp}.pdf`;
        const path_generado = await this.storageService.uploadFile(fakeFile, 'legales', nombreArchivo);
        
        path_poliza = path_generado; // Asignamos el PDF generado como póliza

      } catch (error) {
        console.error('Error generando PDF:', error);
      }
    }

    // --- D. GUARDAR EN BD ---
    const nuevoReclamo = this.reclamoRepository.create({
      // Datos Texto
      nombre: dto.nombre,
      dni: dto.dni,
      email: dto.email,
      telefono: dto.telefono,
      rol_victima: dto.rol_victima,
      aseguradora_tercero: dto.aseguradora_tercero,
      patente_tercero: dto.patente_tercero,
      patente_propia: dto.patente_propia,
      relato_hecho: dto.relato_hecho,
      fecha_hecho: dto.fecha_hecho,
      lugar_hecho: dto.lugar_hecho,
      localidad: dto.localidad,

      // Sistema
      codigo_seguimiento,
      estado: ReclamoEstado.ENVIADO,
      
      // Asignación de dueño (Productor) si existe, o null
      usuario_creador: productor, 
      
      // Archivos
      path_dni: path_dni!, 
      path_licencia: path_licencia || undefined,
      path_cedula: path_cedula || undefined,
      path_poliza: path_poliza || undefined,
      path_denuncia: path_denuncia || undefined,
      path_fotos: path_fotos || undefined,
      path_medicos: path_medicos || undefined
    });

    await this.reclamoRepository.save(nuevoReclamo);

    // --- E. EMAILS ---
    this.mailService.sendNewReclamoClient(dto.email, dto.nombre, codigo_seguimiento).catch(console.error);
    
    // Notificamos al Admin (y quizás en el futuro al Productor también)
    this.mailService.sendNewReclamoAdmin({
      nombre: dto.nombre,
      dni: dto.dni,
      codigo_seguimiento,
      tipo: dto.rol_victima 
    }).catch(console.error);

    return { message: '¡Éxito!', codigo_seguimiento };
  }

  // --- RESTO DE MÉTODOS ---

  async findAll(estado?: string) {
    const where = estado ? { estado: estado as ReclamoEstado } : {};
    return this.reclamoRepository.find({ 
      where, 
      order: { fecha_creacion: 'DESC' },
      relations: ['usuario_creador'] // Traemos al productor para verlo en el dashboard
    });
  }

  async consultarPorCodigo(codigo: string) {
    const reclamo = await this.reclamoRepository.findOne({ where: { codigo_seguimiento: codigo } });
    if (!reclamo) throw new NotFoundException('Código no encontrado');
    return { codigo_seguimiento: reclamo.codigo_seguimiento, estado: reclamo.estado, fecha_creacion: reclamo.fecha_creacion };
  }

  async update(id: string, body: any) {
    const reclamo = await this.reclamoRepository.findOne({ where: { id } });
    if (!reclamo) throw new NotFoundException('No encontrado');
    
    reclamo.estado = body.estado as ReclamoEstado;
    await this.reclamoRepository.save(reclamo);
    
    this.mailService.sendStatusUpdate(reclamo.email, reclamo.nombre, reclamo.estado).catch(console.error);
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
      'medicos': 'path_medicos'
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
      relations: ['usuario_creador'] // 👈 ESTO ES LO QUE FALTABA
    }); 

    if (!reclamo) throw new NotFoundException('Reclamo no encontrado');
    return reclamo;
  }
  remove(id: string) { return this.reclamoRepository.delete(id); }

  async findAllByUser(userId: string) {
    return this.reclamoRepository.find({
      where: { usuario_creador: { id: userId } }, // Filtra por TU id
      order: { fecha_creacion: 'DESC' },
      relations: ['usuario_creador'] 
    });
  }
}