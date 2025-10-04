import { z } from 'zod';

import { logger as defaultLogger, Logger, maskSecrets } from '../../utils/logger';
import type { APIConfig } from './types';
import { AuthStrategy } from './types';

type EnvLoader = (key: string) => string | undefined;

const LOG_LEVEL = z.enum(['error', 'warn', 'info', 'debug']);

const ApiConfigSchema = z.object({
  baseUrl: z.string().url('유효한 API 기본 URL이 필요합니다.'),
  apiKey: z.string().optional(),
  serviceKey: z.string().optional(),
  authStrategy: z.nativeEnum(AuthStrategy).default(AuthStrategy.CustomKey),
  timeout: z.number().int().positive().optional(),
  retryAttempts: z.number().int().positive().max(5).optional(),
  logLevel: LOG_LEVEL.optional(),
});

const defaultEnvLoader: EnvLoader = key => process.env[key];

export interface LoadConfigOptions {
  overrides?: Partial<APIConfig>;
  logger?: Logger;
  env?: EnvLoader;
}

export const loadAPIConfig = (name: string, options: LoadConfigOptions = {}): APIConfig => {
  const upperName = name.toUpperCase();
  const env = options.env ?? defaultEnvLoader;
  const logger = options.logger ?? defaultLogger;

  const raw: Record<string, unknown> = {
    baseUrl: options.overrides?.baseUrl ?? env(`${upperName}_BASE_URL`),
    apiKey: options.overrides?.apiKey ?? env(`${upperName}_API_KEY`),
    serviceKey: options.overrides?.serviceKey ?? env(`${upperName}_SERVICE_KEY`),
    authStrategy: options.overrides?.authStrategy,
    timeout: options.overrides?.timeout ?? parseOptionalInt(env(`${upperName}_TIMEOUT`)),
    retryAttempts: options.overrides?.retryAttempts ?? parseOptionalInt(env(`${upperName}_RETRY_ATTEMPTS`)),
    logLevel: options.overrides?.logLevel ?? env(`${upperName}_LOG_LEVEL`),
  };

  const auth = options.overrides?.authStrategy ?? env(`${upperName}_AUTH_STRATEGY`);
  if (auth && typeof auth === 'string') {
    raw.authStrategy = mapAuthStrategy(auth) ?? raw.authStrategy;
  }

  const result = ApiConfigSchema.safeParse(raw);
  if (!result.success) {
    logger.error('API configuration validation failed', { name, issues: result.error.issues });
    throw new Error(`API 설정을 확인해주세요: ${name}`);
  }

  const config = result.data;

  logger.debug('API configuration loaded', {
    name,
    config: maskSecrets(config),
  });

  return config;
};

const parseOptionalInt = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const mapAuthStrategy = (value: string): AuthStrategy | undefined => {
  const normalized = value.toLowerCase();
  if (normalized === AuthStrategy.CustomKey) return AuthStrategy.CustomKey;
  if (normalized === AuthStrategy.ServiceKey) return AuthStrategy.ServiceKey;
  return undefined;
};
