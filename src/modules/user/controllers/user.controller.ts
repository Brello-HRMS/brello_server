import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ListEmployeesDto } from '../dto/list-employees.dto';
import { MapDepartmentDesignationDto } from '../dto/map-department-designation.dto';
import { UnmapDepartmentDesignationDto } from '../dto/unmap-department-designation.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

// User Controller - Handles HTTP requests for user management
@Controller('users')
@UseGuards(JwtAuthGuard, AccessGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Create a new user
  @Post()
  @RequirePermission('ACCESS_USERS', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createUserDto: CreateUserDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.userService.create(createUserDto, user);
  }

  // Get all employees (users with both department and designation mapped)
  @Get()
  @RequirePermission('ACCESS_USERS', 'view')
  @HttpCode(HttpStatus.OK)
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListEmployeesDto,
  ) {
    return this.userService.findAll(user, query);
  }

  // Get general users (users missing department or designation mapping)
  @Get('general')
  @RequirePermission('ACCESS_USERS', 'view')
  @HttpCode(HttpStatus.OK)
  findGeneralUsers(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListEmployeesDto,
  ) {
    return this.userService.findGeneralUsers(user, query);
  }

  // List all users scoped to the caller's organization and enterprise
  @Get('list')
  @RequirePermission('ACCESS_USERS', 'view')
  @HttpCode(HttpStatus.OK)
  listAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.userService.listAllUsers(user);
  }

  // Map missing department and designation for a user
  @Patch('map')
  @RequirePermission('ACCESS_USERS', 'update')
  @HttpCode(HttpStatus.OK)
  mapDepartmentAndDesignation(
    @Body() dto: MapDepartmentDesignationDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.userService.mapDepartmentAndDesignation(dto, user);
  }

  // Unmap department and designation for a user
  @Patch('unmap')
  @RequirePermission('ACCESS_USERS', 'update')
  @HttpCode(HttpStatus.OK)
  unmapDepartmentAndDesignation(
    @Body() dto: UnmapDepartmentDesignationDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.userService.unmapDepartmentAndDesignation(dto, user);
  }

  // Get user by ID
  @Get(':id')
  @RequirePermission('ACCESS_USERS', 'view')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    const found = await this.userService.findOne(id, user);
    return plainToInstance(UserResponseDto, found, { excludeExtraneousValues: true });
  }

  // Update a user
  @Patch(':id')
  @RequirePermission('ACCESS_USERS', 'update')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    const updated = await this.userService.update(id, updateUserDto, user);
    return plainToInstance(UserResponseDto, updated, { excludeExtraneousValues: true });
  }

  // Delete a user (soft delete)
  @Delete(':id')
  @RequirePermission('ACCESS_USERS', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.userService.remove(id, user);
  }
}
