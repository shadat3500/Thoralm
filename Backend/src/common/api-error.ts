import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    error: string,
    message: string,
    extra?: Record<string, unknown>,
  ) {
    super({ statusCode: status, error, message, ...extra }, status);
  }
}
