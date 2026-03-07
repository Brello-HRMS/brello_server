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
import { PlanModuleActionService } from '../services/plan-module-action.service';
import {
  CreatePlanModuleActionDto,
  UpdatePlanModuleActionDto,
} from '../dto/plan-module-action.dto';

@Controller('plan-module-actions')
export class PlanModuleActionController {
  constructor(
    private readonly planModuleActionService: PlanModuleActionService,
  ) {}

  @Post()
  create(@Body() createPlanModuleActionDto: CreatePlanModuleActionDto) {
    return this.planModuleActionService.create(createPlanModuleActionDto);
  }

  @Get()
  findAll() {
    return this.planModuleActionService.findAll();
  }

  @Get('plan/:planId/module/:moduleId')
  findByPlanAndModule(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.planModuleActionService.findByPlanAndModule(planId, moduleId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.planModuleActionService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlanModuleActionDto: UpdatePlanModuleActionDto,
  ) {
    return this.planModuleActionService.update(id, updatePlanModuleActionDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.planModuleActionService.remove(id);
  }
}
