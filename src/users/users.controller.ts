import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'; 

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 👇 Helper reutilizable en vez de repetir el if en cada método
  private validarAdmin(req: any) {
    const rol = req.user?.role;
    if (rol !== 'Admin' && rol !== 'ADMIN') {
      throw new UnauthorizedException('Acceso denegado. Solo un administrador puede realizar esta acción.');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createUserDto: CreateUserDto, @Request() req) {
    this.validarAdmin(req);
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard) 
  @Get('mis-referidos')
  async findMyTeam(@Request() req) {
    const userId = req.user.id || req.user.userId;
    return this.usersService.findReferidos(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Query('role') role?: string,
    @Query('approved') approved?: string 
  ) {
    return this.usersService.findAll(role, approved);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Request() req) {
    this.validarAdmin(req);
    return this.usersService.approveUser(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/role')
  async cambiarRol(
    @Param('id') id: string,
    @Body('role') nuevoRol: string,
    @Request() req
  ) {
    this.validarAdmin(req);

    const rolesPermitidos = ['Productor', 'Organizador', 'Tramitador'];
    if (!rolesPermitidos.includes(nuevoRol)) {
      throw new UnauthorizedException(`Operación rechazada. No está permitido asignar el rol "${nuevoRol}" mediante este canal.`);
    }

    return this.usersService.cambiarRol(id, nuevoRol);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('perfil/cambiar-password')
  async cambiarMiPassword(
    @Body() body: any,
    @Request() req
  ) {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    if (!userId) throw new UnauthorizedException('Token inválido: No se pudo extraer el ID del usuario.');

    const { passwordActual, passwordNueva } = body;
    if (!passwordActual || !passwordNueva) {
      throw new BadRequestException('Debe proporcionar la contraseña actual y la nueva.');
    }

    const cumpleSeguridad = passwordNueva.length >= 8 && /(?=.*[A-Z])(?=.*\d)/.test(passwordNueva);
    if (!cumpleSeguridad) {
      throw new BadRequestException('La nueva contraseña debe tener mínimo 8 caracteres, incluir al menos una mayúscula y un número.');
    }

    return this.usersService.cambiarMiPassword(userId, passwordActual, passwordNueva);
  }

  // 👇 Sin uso actual en el front, pero lo cerramos igual: admin-only
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    this.validarAdmin(req);
    return this.usersService.findOne(id);
  }

  // 👇 Sin uso actual en el front, cerrado + DTO ya no acepta password/role (ver punto 2)
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    this.validarAdmin(req);
    return this.usersService.update(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    this.validarAdmin(req);
    return this.usersService.remove(id);
  }
}