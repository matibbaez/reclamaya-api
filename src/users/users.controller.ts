import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'; 

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // -----------------------------------------------------
  // ✅ ENDPOINT RESTAURADO: VER MI EQUIPO
  // -----------------------------------------------------
  @UseGuards(JwtAuthGuard) 
  @Get('mis-referidos')
  async findMyTeam(@Request() req) {
    // Obtenemos el ID del usuario desde el token JWT
    const userId = req.user.id || req.user.userId;
    return this.usersService.findReferidos(userId);
  }

  // -----------------------------------------------------
  // VER TODOS (ADMIN)
  // -----------------------------------------------------
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
  async approve(@Param('id') id: string) {
    return this.usersService.approveUser(id);
  }

  // -----------------------------------------------------
  // CAMBIAR ROL DE USUARIO (SOLO ADMIN Y ROLES PERMITIDOS)
  // -----------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Patch(':id/role')
  async cambiarRol(
    @Param('id') id: string,
    @Body('role') nuevoRol: string,
    @Request() req
  ) {
    // 1. Validamos que quien hace la petición sea estrictamente un Administrador logueado
    const rolUsuarioLogueado = req.user?.role;
    if (rolUsuarioLogueado !== 'Admin' && rolUsuarioLogueado !== 'ADMIN') {
      throw new UnauthorizedException('Acceso denegado. Solo un administrador puede cambiar los roles de los usuarios.');
    }

    // 👇 2. NUEVO: Bloqueo estricto de escalada de privilegios
    const rolesPermitidos = ['Productor', 'Organizador', 'Tramitador'];
    if (!rolesPermitidos.includes(nuevoRol)) {
      throw new UnauthorizedException(`Operación rechazada. No está permitido asignar el rol "${nuevoRol}" mediante este canal.`);
    }

    return this.usersService.cambiarRol(id, nuevoRol);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}