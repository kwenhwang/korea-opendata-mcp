import type { LogLevel } from '../../utils/logger';

export type HttpMethod = 'GET' | 'POST';

export interface RequestOptions {
  endpoint: string;
  method?: HttpMethod;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  expects?: 'json' | 'xml' | 'text';
  retryAttempts?: number;
}

export interface AuthContext {
  params: Record<string, any>;
  headers: Record<string, string>;
}

export interface APIConfig {
  baseUrl: string;
  apiKey?: string;
  serviceKey?: string;
  authStrategy?: AuthStrategy;
  timeout?: number;
  retryAttempts?: number;
  logLevel?: LogLevel;
}

export enum AuthStrategy {
  CustomKey = 'custom',
  ServiceKey = 'service',
}

export interface RetryOptions {
  attempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

export interface RequestContext {
  attempt: number;
  url: string;
  method: HttpMethod;
  maskedParams?: Record<string, unknown>;
  maskedHeaders?: Record<string, string>;
}
