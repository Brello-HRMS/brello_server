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
import { LetterTemplateService } from '../services/letter-template.service';
import { CreateLetterTemplateDto, UpdateLetterTemplateDto } from '../dto/letter-template.dto';

@Controller('letter-templates')
@UseGuards(JwtAuthGuard)
export class LetterTemplateController {
  constructor(private readonly service: LetterTemplateService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query('category_id') categoryId?: string,
  ) {
    return this.service.findAll(user, categoryId);
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
    @Body() dto: CreateLetterTemplateDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLetterTemplateDto,
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
