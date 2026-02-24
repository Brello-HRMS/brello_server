import {
    Controller, Get, Post, Body, Patch, Param, Delete,
    HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { AppService } from '../services/app.service';
import { CreateAppDto } from '../dto/create-app.dto';
import { UpdateAppDto } from '../dto/update-app.dto';

@Controller('apps')
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() dto: CreateAppDto) {
        return this.appService.create(dto);
    }

    @Get()
    @HttpCode(HttpStatus.OK)
    findAll() {
        return this.appService.findAll();
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.appService.findOne(id);
    }

    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAppDto) {
        return this.appService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.appService.remove(id);
    }
}
