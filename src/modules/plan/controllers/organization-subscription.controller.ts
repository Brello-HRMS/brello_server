import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationSubscriptionService } from '../services/organization-subscription.service';
import {
  CreateOrganizationSubscriptionDto,
  UpdateOrganizationSubscriptionDto,
} from '../dto/organization-subscription.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('organization-subscriptions')
@UseGuards(JwtAuthGuard)
export class OrganizationSubscriptionController {
  constructor(
    private readonly subscriptionService: OrganizationSubscriptionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createSubscriptionDto: CreateOrganizationSubscriptionDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.subscriptionService.create(createSubscriptionDto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.subscriptionService.findAll(user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.subscriptionService.findOne(id, user);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSubscriptionDto: UpdateOrganizationSubscriptionDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.subscriptionService.update(id, updateSubscriptionDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.subscriptionService.remove(id, user);
  }
}
