import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { RuleAssignmentService } from '../services/rule-assignment.service';
import { AssignDepartmentsDto } from '../dto/assign-departments.dto';
import { AssignEmployeesDto } from '../dto/assign-employees.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('attendance/rules')
@UseGuards(JwtAuthGuard, AccessGuard)
export class RuleAssignmentController {
  constructor(private readonly assignmentService: RuleAssignmentService) {}

  @Post(':id/assign/departments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'update')
  assignToDepartments(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDepartmentsDto,
  ) {
    return this.assignmentService.assignToDepartments(user, id, dto);
  }

  @Post(':id/assign/employees')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'update')
  assignToEmployees(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignEmployeesDto,
  ) {
    return this.assignmentService.assignToEmployees(user, id, dto);
  }

  @Get(':id/assignments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'view')
  getAssignments(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentService.getAssignments(user, id);
  }
}
