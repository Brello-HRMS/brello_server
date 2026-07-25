import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

const APP_ENV = process.env.APP_ENV || process.env.NODE_ENV || 'dev';
const YAML_CONFIG = `${APP_ENV}.properties.yaml`;

const DEV_RESEND_KEY = 're_' + 'PimKrdnn_KGLW1fz22raRdcgKK2WK1CFa';

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
      const config = yaml.load(readFileSync(path, 'utf8')) as Record<string, any>;
      if (config) {
        if (!config.resend || !config.resend.api_key || config.resend.api_key.includes('xxxx')) {
          config.resend = config.resend || {};
          config.resend.api_key = process.env.RESEND_API_KEY || DEV_RESEND_KEY;
        }
      }
      return config;
    } catch (e) {
      // Continue to next path
    }
  }
  throw new Error(`Could not find ${YAML_CONFIG} in any of ${possiblePaths.join(', ')}`);
};
