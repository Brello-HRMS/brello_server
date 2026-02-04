import { Inject, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import propertiesYaml from './properties.yaml';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [propertiesYaml],
      isGlobal: true,
    }),
  ],
})
export class PropertiesModule {}
