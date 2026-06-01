import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LetterTemplateService } from '../services/letter-template.service';
import { CreateLetterTemplateDto, UpdateLetterTemplateDto } from '../dto/letter-template.dto';

@Controller('letter-templates')
@UseGuards(JwtAuthGuard)
export class LetterTemplateController {
  constructor(private readonly service: LetterTemplateService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@Query('category_id') categoryId?: string) {
    return this.service.findAll(categoryId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLetterTemplateDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLetterTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
