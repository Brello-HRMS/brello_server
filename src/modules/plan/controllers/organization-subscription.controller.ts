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
import { OrganizationSubscriptionService } from '../services/organization-subscription.service';
import {
  CreateOrganizationSubscriptionDto,
  UpdateOrganizationSubscriptionDto,
} from '../dto/organization-subscription.dto';

@Controller('organization-subscriptions')
export class OrganizationSubscriptionController {
  constructor(
    private readonly subscriptionService: OrganizationSubscriptionService,
  ) {}

  @Post()
  create(@Body() createSubscriptionDto: CreateOrganizationSubscriptionDto) {
    return this.subscriptionService.create(createSubscriptionDto);
  }

  @Get()
  findAll() {
    return this.subscriptionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSubscriptionDto: UpdateOrganizationSubscriptionDto,
  ) {
    return this.subscriptionService.update(id, updateSubscriptionDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionService.remove(id);
  }
}
