import { readFileSync, existsSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

/**
 * Loads the YAML configuration from a search list of potential paths.
 * This ensures compatibility across different environments (local, dist, serverless).
 */
export default () => {
  const configFile = 'dev.properties.yaml';
  const searchPaths = [
    // 1. Path relative to Compiled JS (dist) or Source TS (runtime)
    join(__dirname, configFile),
    // 2. Absolute path relative to project root (Vercel/Local)
    join(process.cwd(), 'src/core/properties', configFile),
    // 3. Fallback to dist folder structure
    join(process.cwd(), 'dist/core/properties', configFile),
  ];

  for (const configPath of searchPaths) {
    if (existsSync(configPath)) {
      try {
        const fileContent = readFileSync(configPath, 'utf8');
        return yaml.load(fileContent) as Record<string, any>;
      } catch (error) {
        console.error(`Failed to read config at ${configPath}:`, error);
      }
    }
  }

  // Final fallback if no file is found
  console.warn(
    `Configuration file ${configFile} not found. Using empty config.`,
  );
  return {};
};
