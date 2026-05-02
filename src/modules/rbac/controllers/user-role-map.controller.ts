import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UserRoleMapService } from '../services/user-role-map.service';
import { CreateUserRoleMapDto } from '../dto/create-user-role-map.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { ListUserRoleMapsDto } from '../dto/list-user-role-maps.dto';



@Controller('user-role-maps')
export class UserRoleMapController {
  constructor(private readonly userRoleMapService: UserRoleMapService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserRoleMapDto) {
    return this.userRoleMapService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListUserRoleMapsDto,
  ) {
    return this.userRoleMapService.findAll(user, query);
  }



  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.userRoleMapService.findByUserId(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userRoleMapService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userRoleMapService.remove(id);
  }
}
