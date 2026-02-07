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
} from '@nestjs/common';
import { OrganizationService } from '../services/organization.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';

// Organization Controller - Handles HTTP requests for organization management
@Controller('organizations')
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) { }

    // Create a new organization
    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() createOrganizationDto: CreateOrganizationDto) {
        return this.organizationService.create(createOrganizationDto);
    }

    // Get all organizations
    @Get()
    @HttpCode(HttpStatus.OK)
    findAll() {
        return this.organizationService.findAll();
    }

    // Get organization by ID
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.organizationService.findOne(id);
    }

    // Get organizations by enterprise ID
    @Get('enterprise/:enterpriseId')
    @HttpCode(HttpStatus.OK)
    findByEnterprise(@Param('enterpriseId', ParseUUIDPipe) enterpriseId: string) {
        return this.organizationService.findByEnterpriseId(enterpriseId);
    }

    // Update an organization
    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateOrganizationDto: UpdateOrganizationDto,
    ) {
        return this.organizationService.update(id, updateOrganizationDto);
    }

    // Delete an organization
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.organizationService.remove(id);
    }
}
