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
  Request,
} from '@nestjs/common';
import { AppService } from '../services/app.service';
import { CreateAppDto } from '../dto/create-app.dto';
import { UpdateAppDto } from '../dto/update-app.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';

@Controller('apps')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAppDto) {
    return this.appService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@Request() req: any) {
    if (req.user.isPlatformAdmin) {
      return this.appService.findAll();
    }
    return this.appService.findAllForEnterprise(req.user.enterpriseId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    if (req.user.isPlatformAdmin) {
      return this.appService.findOne(id);
    }
    return this.appService.findOneForEnterprise(id, req.user.enterpriseId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAppDto) {
    return this.appService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.appService.remove(id);
  }
}
