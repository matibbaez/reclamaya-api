import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards,
  UseInterceptors, UploadedFiles, Request, Query, BadRequestException
} from '@nestjs/common';
import { ReclamosService } from './reclamos.service';
import { CreateReclamoDto } from './dto/create-reclamo.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

// 1. INTERFACE DE PATHS
interface IPathsReclamo {
  dni: 'path_dni';
  licencia: 'path_licencia';
  cedula: 'path_cedula';
  poliza: 'path_poliza';
  denuncia: 'path_denuncia';
  fotos: 'path_fotos';
  medicos: 'path_medicos';
}

@Controller('reclamos')
export class ReclamosController {
  constructor(private readonly reclamosService: ReclamosService) {}

  // ------------------------------------------------------------------
  // 1. ENDPOINT: "INICIAR RECLAMO" (PÚBLICO)
  // ------------------------------------------------------------------
  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    // Archivos existentes
    { name: 'fileDNI', maxCount: 1 },
    { name: 'fileLicencia', maxCount: 1 },
    { name: 'fileCedula', maxCount: 1 },
    { name: 'fileSeguro', maxCount: 1 },
    { name: 'fileDenuncia', maxCount: 1 },
    { name: 'fileFotos', maxCount: 5 }, 
    { name: 'fileMedicos', maxCount: 1 }, 
    // Archivos NUEVOS del PDF
    { name: 'filePresupuesto', maxCount: 1 },   // "Presupuesto o carta de franquicia"
    { name: 'fileCBU', maxCount: 1 },           // "Comprobante de CBU"
    { name: 'fileDenunciaPenal', maxCount: 1 }, // "Denuncia Penal"
    { name: 'fileFirma', maxCount: 1 },
  ]))
  async create(
    @Body() createReclamoDto: CreateReclamoDto,
    @UploadedFiles() files: { 
      fileDNI?: Express.Multer.File[], 
      fileLicencia?: Express.Multer.File[], 
      fileCedula?: Express.Multer.File[], 
      fileSeguro?: Express.Multer.File[], 
      fileDenuncia?: Express.Multer.File[], 
      fileFotos?: Express.Multer.File[], 
      fileMedicos?: Express.Multer.File[],
      filePresupuesto?: Express.Multer.File[],   
      fileCBU?: Express.Multer.File[],           
      fileDenunciaPenal?: Express.Multer.File[]  
      fileFirma?: Express.Multer.File[]
    }
  ) {
    return this.reclamosService.create(createReclamoDto, files); 
  }

  // ------------------------------------------------------------------
  // 2. ENDPOINT: "CONSULTAR TRÁMITE" (PÚBLICO)
  // ------------------------------------------------------------------
  @Get('consultar/:codigo')
  async consultarEstado(
    @Param('codigo') codigo: string,
    @Query('dni') dni: string // 👈 Agregamos esto
  ) {
    // Validamos que venga el DNI
    if (!dni) throw new BadRequestException('El DNI es obligatorio para la consulta.');
    
    return this.reclamosService.consultarPorCodigo(codigo, dni);
  }

  @Get(':id/galeria')
  // @UseGuards(JwtAuthGuard) // Descomentar si usás seguridad
  async getGaleria(@Param('id') id: string) {
    return this.reclamosService.getGaleria(id);
  }

  // ------------------------------------------------------------------
  // 3. ENDPOINT: "MIS SINIESTROS" (PRODUCTOR/TRAMITADOR)
  // ------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Get('mis-siniestros')
  async findMisSiniestros(@Request() req) {
    const userId = req.user.id || req.user.userId; 
    return this.reclamosService.findAllByUser(userId);
  }

  // ------------------------------------------------------------------
  // 4. ENDPOINT: "ASIGNAR TRAMITADOR" (ADMIN) - ¡NUEVO!
  // ------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Patch(':id/asignar')
  async asignarTramitador(
    @Param('id') id: string,
    @Body('tramitadorId') tramitadorId: string
  ) {
    if (!tramitadorId) throw new BadRequestException('Falta el ID del tramitador');
    return this.reclamosService.asignarTramitador(id, tramitadorId);
  }

  // ------------------------------------------------------------------
  // 5. ENDPOINT: "VER TODOS" (ADMIN)
  // ------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('estado') estado?: string) {
    return this.reclamosService.findAll(estado);
  }

  // ------------------------------------------------------------------
  // 6. ENDPOINT: "ACTUALIZAR ESTADO" (ADMIN/TRAMITADOR)
  // ------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.reclamosService.update(id, body);
  }

  // ------------------------------------------------------------------
  // 7. ENDPOINT: "DESCARGAR ARCHIVO" (PRIVADO)
  // ------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Get('descargar/:id/:tipo')
  async descargarArchivo(
    @Param('id') id: string,
    @Param('tipo') tipo: keyof IPathsReclamo,
  ) {
    const urlTemporal = await this.reclamosService.getArchivoUrl(id, tipo);
    return { url: urlTemporal };
  }

  // ------------------------------------------------------------------
  // OTROS MÉTODOS DE GESTIÓN
  // ------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) { return this.reclamosService.findOne(id); }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) { return this.reclamosService.remove(id); }

  @Post(':id/mensajes')
  @UseGuards(JwtAuthGuard)
  async agregarMensaje(
    @Param('id') id: string,
    @Body('texto') texto: string
  ) {
    if (!texto) throw new BadRequestException('El mensaje no puede estar vacío');
    return this.reclamosService.agregarMensaje(id, texto);
  }

  @Post(':id/notas-internas')
  @UseGuards(JwtAuthGuard)
  async agregarNotaInterna(
    @Param('id') id: string,
    @Body('texto') texto: string
  ) {
    return this.reclamosService.agregarNotaInterna(id, texto);
  }
}