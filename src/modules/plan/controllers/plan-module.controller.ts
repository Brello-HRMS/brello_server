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
import { PlanModuleService } from '../services/plan-module.service';
import {
  CreatePlanModuleDto,
  UpdatePlanModuleDto,
} from '../dto/plan-module.dto';

@Controller('plan-modules')
export class PlanModuleController {
  constructor(private readonly planModuleService: PlanModuleService) {}

  @Post()
  create(@Body() createPlanModuleDto: CreatePlanModuleDto) {
    return this.planModuleService.create(createPlanModuleDto);
  }

  @Get()
  findAll() {
    return this.planModuleService.findAll();
  }

  @Get('plan/:planId')
  findByPlan(@Param('planId', ParseUUIDPipe) planId: string) {
    return this.planModuleService.findByPlan(planId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.planModuleService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlanModuleDto: UpdatePlanModuleDto,
  ) {
    return this.planModuleService.update(id, updatePlanModuleDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.planModuleService.remove(id);
  }
}
