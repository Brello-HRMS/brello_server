import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

const APP_ENV = process.env.APP_ENV || process.env.NODE_ENV || 'dev';
const YAML_CONFIG = `${APP_ENV}.properties.yaml`;

export default () => {
  const possiblePaths = [
    ...(process.env.CONFIG_FILE_PATH ? [process.env.CONFIG_FILE_PATH] : []),
    join(__dirname, YAML_CONFIG),
    join(__dirname, '..', '..', '..', 'core', 'properties', YAML_CONFIG),
    join(process.cwd(), 'src', 'core', 'properties', YAML_CONFIG),
    join(process.cwd(), 'dist', 'src', 'core', 'properties', YAML_CONFIG),
    join(process.cwd(), 'dist', 'core', 'properties', YAML_CONFIG),
  ];

  for (const path of possiblePaths) {
    try {
      return yaml.load(readFileSync(path, 'utf8')) as Record<string, any>;
    } catch (e) {
      // Continue to next path
    }
  }
  throw new Error(`Could not find ${YAML_CONFIG} in any of ${possiblePaths.join(', ')}`);
};
