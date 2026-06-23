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
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { LetterCategoryService } from '../services/letter-category.service';
import { CreateLetterCategoryDto, UpdateLetterCategoryDto } from '../dto/letter-category.dto';
import type { DocumentType } from '../entities/letter-category.entity';

@Controller('letter-categories')
@UseGuards(JwtAuthGuard)
export class LetterCategoryController {
  constructor(private readonly service: LetterCategoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query('document_type') documentType?: DocumentType,
  ) {
    return this.service.findAll(user, documentType);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateLetterCategoryDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLetterCategoryDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user, id);
  }
}
