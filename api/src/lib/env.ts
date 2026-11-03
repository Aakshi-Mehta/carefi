import dotenv from 'dotenv';
dotenv.config();

// Validates required environment variables at startup.
// Returns a safe error message — never exposes secrets.

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  APP_URL: string;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  DEMO_MODE: boolean;
  WHATSAPP_PROVIDER: 'meta' | 'mock';
  DRIVE_PROVIDER: 'google' | 'demo';
  EMAIL_PROVIDER: 'smtp' | 'mock';
  // Optional — only required when providers are enabled
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  GOOGLE_DRIVE_FOLDER_ID?: string;
  META_ACCESS_TOKEN?: string;
  META_PHONE_NUMBER_ID?: string;
  META_WABA_ID?: string;
  META_GRAPH_API_VERSION: string;
  META_WEBHOOK_VERIFY_TOKEN?: string;
  META_APP_SECRET?: string;
  META_MESSAGE_TEMPLATE_NAME?: string;
  META_MESSAGE_TEMPLATE_LANGUAGE: string;
  EMAIL_HOST?: string;
  EMAIL_PORT?: number;
  EMAIL_SECURE?: boolean;
  EMAIL_USER?: string;
  EMAIL_PASS?: string;
  EMAIL_FROM: string;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (_config) return _config;

  const NODE_ENV = process.env.NODE_ENV || 'development';
  const isDemo = process.env.DEMO_MODE === 'true';

  // In test/demo mode, relax MongoDB requirement
  const MONGODB_URI =
    NODE_ENV === 'test'
      ? process.env.MONGODB_URI || 'mongodb://localhost:27017/revnow_test'
      : requireEnv('MONGODB_URI');

  const JWT_SECRET =
    NODE_ENV === 'test'
      ? process.env.JWT_SECRET || 'test-secret-not-for-production'
      : requireEnv('JWT_SECRET');

  const whatsappProvider = (process.env.WHATSAPP_PROVIDER || 'mock') as 'meta' | 'mock';
  const driveProvider = (process.env.DRIVE_PROVIDER || 'demo') as 'google' | 'demo';
  const emailProvider = (process.env.EMAIL_PROVIDER || 'mock') as 'smtp' | 'mock';

  // Validate provider-specific required vars
  if (whatsappProvider === 'meta') {
    requireEnv('META_ACCESS_TOKEN');
    requireEnv('META_PHONE_NUMBER_ID');
    requireEnv('META_WEBHOOK_VERIFY_TOKEN');
    requireEnv('META_MESSAGE_TEMPLATE_NAME');
  }
  if (driveProvider === 'google') {
    requireEnv('GOOGLE_CLIENT_ID');
    requireEnv('GOOGLE_CLIENT_SECRET');
    requireEnv('GOOGLE_REDIRECT_URI');
  }

  _config = {
    NODE_ENV,
    PORT: parseInt(process.env.PORT || '3001', 10),
    APP_URL: process.env.APP_URL || 'http://localhost:3000',
    MONGODB_URI,
    JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    DEMO_MODE: isDemo,
    WHATSAPP_PROVIDER: whatsappProvider,
    DRIVE_PROVIDER: driveProvider,
    EMAIL_PROVIDER: emailProvider,
    GOOGLE_CLIENT_ID: optionalEnv('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: optionalEnv('GOOGLE_CLIENT_SECRET'),
    GOOGLE_REDIRECT_URI: optionalEnv('GOOGLE_REDIRECT_URI'),
    GOOGLE_DRIVE_FOLDER_ID: optionalEnv('GOOGLE_DRIVE_FOLDER_ID'),
    META_ACCESS_TOKEN: optionalEnv('META_ACCESS_TOKEN'),
    META_PHONE_NUMBER_ID: optionalEnv('META_PHONE_NUMBER_ID'),
    META_WABA_ID: optionalEnv('META_WABA_ID'),
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION || 'v20.0',
    META_WEBHOOK_VERIFY_TOKEN: optionalEnv('META_WEBHOOK_VERIFY_TOKEN'),
    META_APP_SECRET: optionalEnv('META_APP_SECRET'),
    META_MESSAGE_TEMPLATE_NAME: optionalEnv('META_MESSAGE_TEMPLATE_NAME'),
    META_MESSAGE_TEMPLATE_LANGUAGE: process.env.META_MESSAGE_TEMPLATE_LANGUAGE || 'en_US',
    EMAIL_HOST: optionalEnv('EMAIL_HOST'),
    EMAIL_PORT: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : undefined,
    EMAIL_SECURE: process.env.EMAIL_SECURE === 'true',
    EMAIL_USER: optionalEnv('EMAIL_USER'),
    EMAIL_PASS: optionalEnv('EMAIL_PASS'),
    EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@revnow.local',
  };

  return _config;
}

/** Reset config cache — for tests only */
export function _resetConfig(): void {
  _config = null;
}
