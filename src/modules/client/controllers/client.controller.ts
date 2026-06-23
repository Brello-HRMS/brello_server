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
@UseGuards(JwtAuthGuard)
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @AuditLog(AuditLogModule.CLIENT, AuditAction.CREATE, 'client')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createClientDto: CreateClientDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.clientService.create(createClientDto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query() query: ListClientsDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.clientService.findAll(query, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientService.findOne(id);
  }

  @AuditLog(AuditLogModule.CLIENT, AuditAction.UPDATE, 'client')
  @Patch(':id')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientService.remove(id);
  }
}
