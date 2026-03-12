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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentController {

    constructor(private readonly departmentService: DepartmentService) { }

    // POST /departments — create a new department under the authenticated user's org
    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(
        @CurrentUser() user: JwtPayload,
        @Body() createDepartmentDto: CreateDepartmentDto,
    ) {
        return this.departmentService.create(user.userId, createDepartmentDto);
    }

    // GET /departments — list all departments; supports ?status, ?search, ?sort_by, ?sort_order
    @Get()
    @HttpCode(HttpStatus.OK)
    findAll(
        @CurrentUser() user: JwtPayload,
        @Query() filters: ListDepartmentsDto,
    ) {
        return this.departmentService.findAll(user.userId, filters);
    }

    // GET /departments/:id — fetch a single department by UUID within the user's org
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    findOne(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.departmentService.findOne(user.userId, id);
    }

    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    update(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateDepartmentDto: UpdateDepartmentDto,
    ) {
        return this.departmentService.update(user.userId, id, updateDepartmentDto);
    }

    // DELETE /departments/:id — soft-delete (sets is_deleted=true, status=INACTIVE)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.departmentService.remove(user.userId, id);
    }
}
