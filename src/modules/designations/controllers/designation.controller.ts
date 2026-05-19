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
    Query,
    UseGuards,
} from '@nestjs/common';
import { DesignationService } from '../services/designation.service';
import { CreateDesignationDto } from '../dto/create-designation.dto';
import { UpdateDesignationDto } from '../dto/update-designation.dto';
import { FindDesignationsDto } from '../dto/find-designations.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

/**
 * Designation Controller
 *
 * Owns HTTP request / response handling for the designations resource.
 * All routes are protected by JwtAuthGuard.
 * Organization ID is extracted from the JWT token.
 */
@Controller('designations')
@UseGuards(JwtAuthGuard)
export class DesignationController {
    constructor(private readonly designationService: DesignationService) { }

    // Create a new designation
    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(
        @CurrentUser('organizationId') orgId: string,
        @CurrentUser('enterpriseId') enterpriseId: string,
        @Body() createDesignationDto: CreateDesignationDto,
    ) {
        return this.designationService.create(orgId, enterpriseId, createDesignationDto);
    }

    /**
     * List all designations for the user's organization.
     * Accepts optional query params: search, status, department_id
     */
    @Get()
    @HttpCode(HttpStatus.OK)
    findAll(
        @CurrentUser('organizationId') orgId: string,
        @Query() filters: FindDesignationsDto,
    ) {
        return this.designationService.findAll(orgId, filters);
    }

    // Get a single designation by its ID (must belong to user's org)
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    findOne(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.designationService.findOne(id, orgId);
    }

    // Partially update a designation (code and org_id are immutable)
    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    update(
        @CurrentUser('organizationId') orgId: string,
        @CurrentUser('enterpriseId') enterpriseId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateDesignationDto: UpdateDesignationDto,
    ) {
        return this.designationService.update(id, orgId, enterpriseId, updateDesignationDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @CurrentUser('organizationId') orgId: string,
        @CurrentUser('enterpriseId') enterpriseId: string,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.designationService.remove(id, orgId, enterpriseId);
    }
}
