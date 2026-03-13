import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserRoleMapService } from '../services/user-role-map.service';
import { CreateUserRoleMapDto } from '../dto/create-user-role-map.dto';

@Controller('user-role-maps')
export class UserRoleMapController {
  constructor(private readonly userRoleMapService: UserRoleMapService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserRoleMapDto) {
    return this.userRoleMapService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.userRoleMapService.findAll();
  }

  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.userRoleMapService.findByUserId(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userRoleMapService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userRoleMapService.remove(id);
  }
}
