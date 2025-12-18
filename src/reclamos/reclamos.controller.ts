import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Request,
  Query
  // Borré Request porque ya no se usa en el create
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
  // 1. ENDPOINT: "INICIAR RECLAMO" (AHORA ES PÚBLICO 🔓)
  // ------------------------------------------------------------------
  // SIN @UseGuards AQUI
  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'fileDNI', maxCount: 1 },
    { name: 'fileLicencia', maxCount: 1 },
    { name: 'fileCedula', maxCount: 1 },
    { name: 'fileSeguro', maxCount: 1 },
    { name: 'fileDenuncia', maxCount: 1 },
    { name: 'fileFotos', maxCount: 1 },
    { name: 'fileMedicos', maxCount: 1 },
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
      fileMedicos?: Express.Multer.File[]
    }
    // Borré @Request() req -> No hay usuario logueado
  ) {
    // Le saqué el tercer argumento (req.user)
    return this.reclamosService.create(createReclamoDto, files); 
  }

  // ------------------------------------------------------------------
  // 2. ENDPOINT: "CONSULTAR TRÁMITE" (PÚBLICO)
  // ------------------------------------------------------------------
  @Get('consultar/:codigo')
  consultarPorCodigo(@Param('codigo') codigo: string) {
    return this.reclamosService.consultarPorCodigo(codigo);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mis-siniestros')
  async findMisSiniestros(@Request() req) {
    // Obtenemos tu ID desde el Token
    // Nota: Si usás la estrategia default de Nest, puede ser req.user.userId. 
    // Si devolvés la entidad entera en validate(), es req.user.id. Probamos con .id primero.
    const userId = req.user.id || req.user.userId; 
    return this.reclamosService.findAllByUser(userId);
  }

  // ------------------------------------------------------------------
  // 3. ENDPOINT: "VER TODOS" (PRIVADO - ADMIN)
  // ------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('estado') estado?: string) {
    return this.reclamosService.findAll(estado);
  }

  // ------------------------------------------------------------------
  // 4. ENDPOINT: "ACTUALIZAR ESTADO" (PRIVADO - ADMIN)
  // ------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.reclamosService.update(id, body);
  }

  // ------------------------------------------------------------------
  // 5. ENDPOINT: "DESCARGAR ARCHIVO" (PRIVADO - ADMIN)
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
  // OTROS MÉTODOS
  // ------------------------------------------------------------------
  @UseGuards(JwtAuthGuard) // Asumo que ver detalle completo es de admin
  @Get(':id')
  findOne(@Param('id') id: string) { return this.reclamosService.findOne(id); }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) { return this.reclamosService.remove(id); }
}