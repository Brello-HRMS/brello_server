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
import { EnterpriseService } from '../services/enterprise.service';
import { CreateEnterpriseDto } from '../dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from '../dto/update-enterprise.dto';

// Enterprise Controller - Handles HTTP requests for enterprise management
@Controller('enterprises')
export class EnterpriseController {
    constructor(private readonly enterpriseService: EnterpriseService) { }

    // Create a new enterprise
    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() createEnterpriseDto: CreateEnterpriseDto) {
        return this.enterpriseService.create(createEnterpriseDto);
    }

    // Get all enterprises
    @Get()
    @HttpCode(HttpStatus.OK)
    findAll() {
        return this.enterpriseService.findAll();
    }

    // Get enterprise by ID
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.enterpriseService.findOne(id);
    }

    // Update an enterprise
    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateEnterpriseDto: UpdateEnterpriseDto,
    ) {
        return this.enterpriseService.update(id, updateEnterpriseDto);
    }

    // Delete an enterprise
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.enterpriseService.remove(id);
    }
}
