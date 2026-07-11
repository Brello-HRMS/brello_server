import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { groupVariablesByCategory } from '../registry/variable-registry';

@Controller('letter-management/variables')
@UseGuards(JwtAuthGuard)
export class VariableRegistryController {
  @Get()
  findAll() {
    return groupVariablesByCategory();
  }
}
