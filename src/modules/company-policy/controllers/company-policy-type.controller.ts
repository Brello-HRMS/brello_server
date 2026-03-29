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

@Controller('policy-types')
@UseGuards(JwtAuthGuard, AccessGuard)
export class CompanyPolicyTypeController {
    constructor(private readonly typeService: CompanyPolicyTypeService) { }

    @Get()
    @RequirePermission('COMPANY_POLICY', 'view')
    @HttpCode(HttpStatus.OK)
    findAll(@LoggedInUser() user: LoggedInUserInterface) {
        return this.typeService.findAll(user);
    }

    @Post()
    @RequirePermission('COMPANY_POLICY', 'create')
    @HttpCode(HttpStatus.CREATED)
    create(
        @LoggedInUser() user: LoggedInUserInterface,
        @Body() dto: CreateCompanyPolicyTypeDto,
    ) {
        return this.typeService.create(user, dto);
    }

    @Patch(':id')
    @RequirePermission('COMPANY_POLICY', 'edit')
    @HttpCode(HttpStatus.OK)
    update(
        @LoggedInUser() user: LoggedInUserInterface,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCompanyPolicyTypeDto,
    ) {
        return this.typeService.update(user, id, dto);
    }

    @Delete(':id')
    @RequirePermission('COMPANY_POLICY', 'delete')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @LoggedInUser() user: LoggedInUserInterface,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.typeService.remove(user, id);
    }
}
