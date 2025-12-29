import dotenv from 'dotenv';
dotenv.config();

/**
 * Centralized configuration for the application
 * All environment variables are loaded and validated here
 * This ensures all config is loaded BEFORE any other imports
 */

const config = {
  APP_PORT: parseInt(process.env.APP_PORT || '3000', 10),// Server App Port
  MONGO_DB_URI: process.env.MONGO_DB_URI || '',// MongoDBDatabase
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY || '',  // JWT Secret Key
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10), // Security Bcrypt Salt Rounds
  JSON_SPACES: parseInt(process.env.JSON_SPACES || '4', 10), // JSON Pretty Print Spaces
};
// Validate required environment variables
const requiredEnvVars = ['MONGO_DB_URI', 'JWT_SECRET_KEY', 'APP_PORT'];
const missingEnvVars = requiredEnvVars.filter(
  (key) => !config[key as keyof typeof config]
);

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
  process.exit(1);
}

console.log('✅ Configuration loaded successfully');

export default config;
