import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { GeoValidationService } from '../services/geo-validation.service';
import { ValidateGeoDto } from '../dto/validate-geo.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('attendance/geo')
@UseGuards(JwtAuthGuard, AccessGuard)
export class GeoValidationController {
  constructor(private readonly geoValidationService: GeoValidationService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'view')
  validate(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: ValidateGeoDto,
  ) {
    return this.geoValidationService.validate(user, dto);
  }
}
