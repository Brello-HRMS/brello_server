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
import { IndustryTypeService } from '../services/industry-type.service';
import { CreateIndustryTypeDto } from '../dto/create-industry-type.dto';
import { UpdateIndustryTypeDto } from '../dto/update-industry-type.dto';

@Controller('industry-types')
export class IndustryTypeController {
  constructor(private readonly industryTypeService: IndustryTypeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createIndustryTypeDto: CreateIndustryTypeDto) {
    return this.industryTypeService.create(createIndustryTypeDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.industryTypeService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.industryTypeService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateIndustryTypeDto: UpdateIndustryTypeDto,
  ) {
    return this.industryTypeService.update(id, updateIndustryTypeDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.industryTypeService.remove(id);
  }
}
