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
import { ClientService } from '../services/client.service';
import { CreateClientDto } from '../dto/create-client.dto';
import { UpdateClientDto } from '../dto/update-client.dto';
import { ListClientsDto } from '../dto/list-clients.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('clients')
@UseGuards(JwtAuthGuard, AccessGuard)
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @AuditLog(AuditLogModule.CLIENT, AuditAction.CREATE, 'client')
  @Post()
  @RequirePermission('CLIENT', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createClientDto: CreateClientDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.clientService.create(createClientDto, user);
  }

  @Get()
  @RequirePermission('CLIENT', 'view')
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query() query: ListClientsDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.clientService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('CLIENT', 'view')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.clientService.findOne(id, user);
  }

  @AuditLog(AuditLogModule.CLIENT, AuditAction.UPDATE, 'client')
  @Patch(':id')
  @RequirePermission('CLIENT', 'update')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClientDto: UpdateClientDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.clientService.update(id, updateClientDto, user);
  }

  @AuditLog(AuditLogModule.CLIENT, AuditAction.DELETE, 'client')
  @Delete(':id')
  @RequirePermission('CLIENT', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.clientService.remove(id, user);
  }
}
