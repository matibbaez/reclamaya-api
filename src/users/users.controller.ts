import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
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
  findAll(@Query('role') role?: string) {
    return this.usersService.findAll(role);
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