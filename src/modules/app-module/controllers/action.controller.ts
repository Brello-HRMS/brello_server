import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ActionService } from '../services/action.service';
import { CreateActionDto, UpdateActionDto } from '../dto/action.dto';

@Controller('actions')
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  @Post()
  create(@Body() createActionDto: CreateActionDto) {
    return this.actionService.create(createActionDto);
  }

  @Get()
  findAll() {
    return this.actionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.actionService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateActionDto: UpdateActionDto,
  ) {
    return this.actionService.update(id, updateActionDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.actionService.remove(id);
  }
}
