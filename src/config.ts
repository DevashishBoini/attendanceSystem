import dotenv from 'dotenv';
dotenv.config();

/**
 * Centralized configuration for the application
 * All environment variables are loaded and validated here
 * This ensures all config is loaded BEFORE any other imports
 */

type Config = {
  APP_PORT: number;
  MONGO_DB_URI: string;
  JWT_SECRET_KEY: string;
  JWT_EXPIRATION: number;  // In seconds
  BCRYPT_SALT_ROUNDS: number;
  JSON_SPACES: number;
};

const config: Config = {
  APP_PORT: parseInt(process.env.APP_PORT || '3000', 10),
  MONGO_DB_URI: process.env.MONGO_DB_URI || '',
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY || '',
  JWT_EXPIRATION: parseInt(process.env.JWT_EXPIRATION || '3600', 10),  // In seconds, default 1h (3600s)
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  JSON_SPACES: parseInt(process.env.JSON_SPACES || '4', 10),
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
