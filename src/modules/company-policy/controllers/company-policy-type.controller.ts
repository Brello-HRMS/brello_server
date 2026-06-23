import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
} from '@nestjs/common';
import { CompanyPolicyTypeService } from '../services/company-policy-type.service';
import { CreateCompanyPolicyTypeDto, UpdateCompanyPolicyTypeDto } from '../dto/policy-type.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('policy-types')
@UseGuards(JwtAuthGuard, AccessGuard)
export class CompanyPolicyTypeController {
    constructor(private readonly typeService: CompanyPolicyTypeService) { }

    @Get()
    @RequirePermission('ORG_POLICIES', 'view')
    @HttpCode(HttpStatus.OK)
    findAll(@LoggedInUser() user: LoggedInUserInterface) {
        return this.typeService.findAll(user);
    }

    @AuditLog(AuditLogModule.COMPANY_POLICY, AuditAction.CREATE, 'policy_type')
    @Post()
    @RequirePermission('ORG_POLICIES', 'create')
    @HttpCode(HttpStatus.CREATED)
    create(
        @LoggedInUser() user: LoggedInUserInterface,
        @Body() dto: CreateCompanyPolicyTypeDto,
    ) {
        return this.typeService.create(user, dto);
    }

    @AuditLog(AuditLogModule.COMPANY_POLICY, AuditAction.UPDATE, 'policy_type')
    @Patch(':id')
    @RequirePermission('ORG_POLICIES', 'edit')
    @HttpCode(HttpStatus.OK)
    update(
        @LoggedInUser() user: LoggedInUserInterface,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCompanyPolicyTypeDto,
    ) {
        return this.typeService.update(user, id, dto);
    }

    @AuditLog(AuditLogModule.COMPANY_POLICY, AuditAction.DELETE, 'policy_type')
    @Delete(':id')
    @RequirePermission('ORG_POLICIES', 'delete')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @LoggedInUser() user: LoggedInUserInterface,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.typeService.remove(user, id);
    }
}
