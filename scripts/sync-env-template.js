#!/usr/bin/env node

/**
 * Sync .env template from .env file
 * Reads .env, replaces all values with <value>, and writes to .env-template
 * 
 * Usage: node scripts/sync-env-template.js
 */

import fs from 'fs';

const ENV_FILE = '.env';
const TEMPLATE_FILE = '.env-template';

try {
  // Check if .env exists
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`❌ ${ENV_FILE} not found`);
    process.exit(1);
  }

  // Read .env file
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');

  // Parse and transform to template
  const templateContent = envContent
    .split('\n')
    .map((line) => {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) {
        return line;
      }

      // Split by first = only
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) {
        return line;
      }

      const key = line.substring(0, eqIndex);
      return `${key}=<value>`;
    })
    .join('\n');

  // Write to template file
  fs.writeFileSync(TEMPLATE_FILE, templateContent, 'utf-8');

  console.log(`✅ ${TEMPLATE_FILE} synced successfully from ${ENV_FILE}`);
  console.log(`   All values replaced with <value> placeholder`);
} catch (error) {
  console.error('❌ Error syncing template:', error.message);
  process.exit(1);
}
