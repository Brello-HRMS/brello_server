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
} from '@nestjs/common';
import { DesignationService } from '../services/designation.service';
import { CreateDesignationDto } from '../dto/create-designation.dto';
import { UpdateDesignationDto } from '../dto/update-designation.dto';
import { FindDesignationsDto } from '../dto/find-designations.dto';

/**
 * Designation Controller
 *
 * Owns HTTP request / response handling for the designations resource.
 * No business logic lives here — it delegates entirely to DesignationService.
 *
 * Routes:
 *  POST   /designations              → create
 *  GET    /designations/org/:orgId   → list by org (with optional filters)
 *  GET    /designations/:id          → get single
 *  PATCH  /designations/:id          → update
 *  DELETE /designations/:id          → soft delete
 */
@Controller('designations')
export class DesignationController {
    constructor(private readonly designationService: DesignationService) { }

    // Create a new designation
    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() createDesignationDto: CreateDesignationDto) {
        return this.designationService.create(createDesignationDto);
    }

    /**
     * List all designations for an organization.
     * Accepts optional query params: search, status, department_id
     * Example: GET /designations/org/:orgId?status=ACTIVE&search=engineer
     */
    @Get('org/:orgId')
    @HttpCode(HttpStatus.OK)
    findAll(
        @Param('orgId', ParseUUIDPipe) orgId: string,
        @Query() filters: FindDesignationsDto,
    ) {
        return this.designationService.findAll(orgId, filters);
    }

    // Get a single designation by its ID
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.designationService.findOne(id);
    }

    // Partially update a designation (code and org_id are immutable)
    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateDesignationDto: UpdateDesignationDto,
    ) {
        return this.designationService.update(id, updateDesignationDto);
    }

    // Soft-delete a designation (sets status to INACTIVE)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.designationService.remove(id);
    }
}
