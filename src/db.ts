import mongoose from 'mongoose';
import type { Connection, ConnectOptions } from 'mongoose';
import config from './config.js';
import type { SupportedServerApiVersion } from './constants.js';



interface MongoClientOptions {
  serverApi: {
    version: SupportedServerApiVersion;
    strict: boolean;
    deprecationErrors: boolean;
  };
}

class DatabaseClient {
  private uri: string;
  private clientOptions: MongoClientOptions;
  private connection: Connection | null = null;
  private readonly supportedVersions: SupportedServerApiVersion[] = ['1'];

  constructor(uri: string) {
    this.uri = uri;
    this.clientOptions = this.buildClientOptions('1');
  }

  /**
    Validates and builds MongoDB client connection options with strict type checking.
   * 
   * This method ensures that only supported MongoDB Server API versions are used,
   * providing runtime validation in addition to TypeScript's compile-time checks.
   * It centralizes the client options configuration, making it easy to update
   * settings across the entire application.
   * 
   * @param version - The MongoDB Server API version to use (e.g., '1', '2', '3')
   *                  Must be one of the supported versions defined in `supportedVersions`
   * 
   * @returns {MongoClientOptions} A validated MongoDB client options object with:
   *          - serverApi.version: The validated API version
   *          - serverApi.strict: Enforces strict API compliance (true)
   *          - serverApi.deprecationErrors: Throws errors on deprecated features (true)
   * 
   * @throws {Error} If the requested version is not in the supported versions list.
   *         Error message includes the requested version and list of supported versions.
   * 
   * @example
   * // Using default version
   * const options = this.buildClientOptions('1');
   * 
   * // Will throw error - version 2 not supported yet
   * const options = this.buildClientOptions('2');  // Throws: "Unsupported MongoDB API version: '2'"
   * 
   * @remarks
   * - This is a private method called during construction
   * - Adding new versions: update `supportedVersions` array and this method
   * - Version validation happens at runtime before MongoDB connection attempt
   * - This prevents silent failures or unexpected behavior with wrong versions
   */
  private buildClientOptions(version: string): MongoClientOptions {
    if (!this.supportedVersions.includes(version as SupportedServerApiVersion)) {
      throw new Error(
        `❌ Unsupported MongoDB API version: '${version}'. ` +
        `Supported versions: ${this.supportedVersions.join(', ')}`
      );
    }

    return {
      serverApi: {
        version: version as SupportedServerApiVersion,
        strict: true,
        deprecationErrors: true,
      },
    };
  }

  async connect(): Promise<void> {
    try {
      // Type assertion is safe here because buildClientOptions validates the version
      const connectOptions: ConnectOptions = this.clientOptions;
      await mongoose.connect(this.uri, connectOptions);
      this.connection = mongoose.connection;
      console.log('✅ Connected to MongoDB!');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await mongoose.disconnect();
      this.connection = null;
      console.log('✅ Disconnected from MongoDB!');
    } catch (error) {
      console.error('❌ MongoDB disconnection failed:', error);
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.connection?.db?.admin().command({ ping: 1 });
      console.log('✅ MongoDB ping successful!');
      return true;
    } catch (error) {
      console.error('❌ MongoDB ping failed:', error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.connection?.readyState === 1;
  }

  getConnection(): Connection | null {
    return this.connection;
  }

  /**
   * Get list of supported MongoDB API versions
   */
  getSupportedVersions(): SupportedServerApiVersion[] {
    return [...this.supportedVersions];
  }
}

let dbClientInstance: DatabaseClient | null = null;

function getDbClient(): DatabaseClient {
  if (!dbClientInstance) {
    dbClientInstance = new DatabaseClient(config.MONGO_DB_URI);
  }
  return dbClientInstance;
}

export async function connectDB(): Promise<void> {
  console.log('🔌 Connecting to MongoDB...');
  const client = getDbClient();
  await client.connect();
  await client.ping();
}

