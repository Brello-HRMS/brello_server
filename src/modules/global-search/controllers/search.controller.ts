import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { SearchQueryDto, SaveRecentSearchDto } from '../dto';
import { SearchQueryService } from '../services/search-query.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchQueryService: SearchQueryService) {}

  @Get()
  async search(
    @Query() query: SearchQueryDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.searchQueryService.search(query.q ?? '', user);
  }

  @Get('recent')
  async getRecentSearches(@LoggedInUser() user: LoggedInUserInterface) {
    return this.searchQueryService.getRecentSearches(user);
  }

  @Post('recent')
  @HttpCode(201)
  async saveRecentSearch(
    @Body() dto: SaveRecentSearchDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.searchQueryService.saveRecentSearch(dto, user);
  }
}
