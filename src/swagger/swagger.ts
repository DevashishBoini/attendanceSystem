import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Swagger/OpenAPI Configuration
 * Loads the API documentation from openapi.yaml file
 * 
 * Note: File is loaded dynamically on each call (not cached) to enable
 * hot-reload during development. This allows YAML changes to reflect
 * immediately after page refresh without restarting the server.
 */
const yamlPath = path.join(process.cwd(), 'src', 'swagger', 'openapi.yaml');

export function getSwaggerSpec(): Record<string, unknown> {
  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
  return yaml.load(yamlContent) as Record<string, unknown>;
}

export default getSwaggerSpec();
