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
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('industry-types')
@UseGuards(JwtAuthGuard)
export class IndustryTypeController {
  constructor(private readonly industryTypeService: IndustryTypeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createIndustryTypeDto: CreateIndustryTypeDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.industryTypeService.create(createIndustryTypeDto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.industryTypeService.findAll(user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.industryTypeService.findOne(id, user);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateIndustryTypeDto: UpdateIndustryTypeDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.industryTypeService.update(id, updateIndustryTypeDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.industryTypeService.remove(id, user);
  }
}
