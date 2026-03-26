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
import { CompanyPolicyService } from '../services/company-policy.service';
import { CreateCompanyPolicyDto, UpdateCompanyPolicyDto } from '../dto/company-policy.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { PermissionResolverService } from '../../rbac/services/permission-resolver.service';

@Controller('policies')
@UseGuards(JwtAuthGuard, AccessGuard)
export class CompanyPolicyController {
    constructor(
        private readonly policyService: CompanyPolicyService,
        private readonly permissionResolver: PermissionResolverService,
    ) { }

    @Post()
    @RequirePermission('COMPANY_POLICY', 'create')
    @HttpCode(HttpStatus.CREATED)
    create(
        @LoggedInUser() user: LoggedInUserInterface,
        @Body() dto: CreateCompanyPolicyDto,
    ) {
        return this.policyService.create(user, dto);
    }

    @Get('grouped')
    @RequirePermission('COMPANY_POLICY', 'view')
    @HttpCode(HttpStatus.OK)
    async findGrouped(@LoggedInUser() user: LoggedInUserInterface) {
        const canEdit = await this.permissionResolver.hasPermission(user, 'COMPANY_POLICY', 'edit');
        return this.policyService.findGrouped(user, !canEdit);
    }

    @Get(':id')
    @RequirePermission('COMPANY_POLICY', 'view')
    @HttpCode(HttpStatus.OK)
    async findOne(
        @LoggedInUser() user: LoggedInUserInterface,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        const canEdit = await this.permissionResolver.hasPermission(user, 'COMPANY_POLICY', 'edit');
        return this.policyService.findOne(user, id, !canEdit);
    }

    @Patch(':id')
    @RequirePermission('COMPANY_POLICY', 'edit')
    @HttpCode(HttpStatus.OK)
    update(
        @LoggedInUser() user: LoggedInUserInterface,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCompanyPolicyDto,
    ) {
        return this.policyService.update(user, id, dto);
    }

    @Delete(':id')
    @RequirePermission('COMPANY_POLICY', 'delete')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @LoggedInUser() user: LoggedInUserInterface,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.policyService.remove(user, id);
    }
}
