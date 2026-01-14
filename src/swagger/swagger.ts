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
const openApiPath = path.join(process.cwd(), 'src', 'swagger', 'openapi.yaml');
const asyncApiPath = path.join(process.cwd(), 'src', 'swagger', 'asyncapi.yaml');

export function getSwaggerSpec(): Record<string, unknown> {
  const yamlContent = fs.readFileSync(openApiPath, 'utf-8');
  return yaml.load(yamlContent) as Record<string, unknown>;
}

/**
 * AsyncAPI Configuration
 * Loads the WebSocket API documentation from asyncapi.yaml file
 * 
 * Used for testing WebSocket connections and viewing async event documentation.
 * Dynamically loaded on each call to support hot-reload during development.
 */
export function getAsyncApiSpec(): Record<string, unknown> {
  const yamlContent = fs.readFileSync(asyncApiPath, 'utf-8');
  return yaml.load(yamlContent) as Record<string, unknown>;
}
