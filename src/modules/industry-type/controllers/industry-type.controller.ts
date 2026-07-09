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
} from '@nestjs/common';
import { IndustryTypeService } from '../services/industry-type.service';
import { CreateIndustryTypeDto } from '../dto/create-industry-type.dto';
import { UpdateIndustryTypeDto } from '../dto/update-industry-type.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

/**
 * findAll/findOne stay @Public() — the unauthenticated lead-registration
 * screen populates its industry/business-type dropdown from GET /industry-types.
 * create/update/remove are platform-admin-only.
 */
@Controller('industry-types')
@UseGuards(JwtAuthGuard)
export class IndustryTypeController {
  constructor(private readonly industryTypeService: IndustryTypeService) {}

  @Post()
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createIndustryTypeDto: CreateIndustryTypeDto) {
    return this.industryTypeService.create(createIndustryTypeDto);
  }

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.industryTypeService.findAll();
  }

  @Get(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.industryTypeService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateIndustryTypeDto: UpdateIndustryTypeDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.industryTypeService.update(id, updateIndustryTypeDto);
  }

  @Delete(':id')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.industryTypeService.remove(id);
  }
}
