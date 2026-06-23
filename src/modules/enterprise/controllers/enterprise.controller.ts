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
} from '@nestjs/common';
import { EnterpriseService } from '../services/enterprise.service';
import { CreateEnterpriseDto } from '../dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from '../dto/update-enterprise.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('enterprises')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  @AuditLog(AuditLogModule.PLATFORM_ENTERPRISE, AuditAction.CREATE, 'enterprise')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateEnterpriseDto,
  ) {
    return this.enterpriseService.create(dto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.enterpriseService.findAll(user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.enterpriseService.findOneById(id, user);
  }

  @AuditLog(AuditLogModule.PLATFORM_ENTERPRISE, AuditAction.UPDATE, 'enterprise')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: UpdateEnterpriseDto,
  ) {
    return this.enterpriseService.update(id, dto, user);
  }

  @AuditLog(AuditLogModule.PLATFORM_ENTERPRISE, AuditAction.DELETE, 'enterprise')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.enterpriseService.remove(id, user);
  }
}
