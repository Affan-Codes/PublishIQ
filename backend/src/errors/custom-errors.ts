export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details?: Record<string, any> | undefined;

  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message);
    if (details !== undefined) {
      this.details = details;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

export class ExternalProviderError extends AppError {
  readonly statusCode = 502;
  readonly code = 'EXTERNAL_PROVIDER_ERROR';
  readonly providerName: string;
  readonly originalError?: any | undefined;

  constructor(providerName: string, message: string, originalError?: any | undefined, details?: Record<string, any> | undefined) {
    super(message, details);
    this.providerName = providerName;
    if (originalError !== undefined) {
      this.originalError = originalError;
    }
  }
}
