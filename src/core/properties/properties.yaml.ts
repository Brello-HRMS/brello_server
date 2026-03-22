import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

const YAML_CONFIG = `/dev.properties.yaml`;

export default () => {
  const yamlConfigPath = process.env.CONFIG_FILE_PATH || join(__dirname, YAML_CONFIG);
  
  return yaml.load(
    readFileSync(yamlConfigPath, 'utf8'),
  ) as Record<string, any>;
};
