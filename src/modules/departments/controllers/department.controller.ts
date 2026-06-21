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

import { DepartmentService } from '../services/department.service';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { ListDepartmentsDto } from '../dto/list-departments.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentController {

    constructor(private readonly departmentService: DepartmentService) { }

    // POST /departments — create a new department under the authenticated user's org
    @AuditLog(AuditLogModule.DEPARTMENT, AuditAction.CREATE, 'department')
    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(
        @LoggedInUser() user: LoggedInUserInterface,
        @Body() createDepartmentDto: CreateDepartmentDto,
    ) {
        return this.departmentService.create(user, createDepartmentDto);
    }

    // GET /departments — list all departments; supports ?status, ?search, ?sort_by, ?sort_order
    @Get()
    @HttpCode(HttpStatus.OK)
    findAll(
        @LoggedInUser() user: LoggedInUserInterface,
        @Query() filters: ListDepartmentsDto,
    ) {
        return this.departmentService.findAll(user, filters);
    }

    // GET /departments/:id — fetch a single department by UUID within the user's org
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    findOne(
        @LoggedInUser() user: LoggedInUserInterface,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.departmentService.findOne(user, id);
    }

    @AuditLog(AuditLogModule.DEPARTMENT, AuditAction.UPDATE, 'department')
    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    update(
        @LoggedInUser() user: LoggedInUserInterface,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateDepartmentDto: UpdateDepartmentDto,
    ) {
        return this.departmentService.update(user, id, updateDepartmentDto);
    }

    // DELETE /departments/:id — soft-delete (sets is_deleted=true, status=INACTIVE)
    @AuditLog(AuditLogModule.DEPARTMENT, AuditAction.DELETE, 'department')
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @LoggedInUser() user: LoggedInUserInterface,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.departmentService.remove(user, id);
    }
}
