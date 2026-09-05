import {

  ArgumentsHost,

  Catch,

  ExceptionFilter,

  HttpException,

  HttpStatus,

  Logger,

} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from './middleware/request-id.middleware';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = req?.header?.(REQUEST_ID_HEADER);

    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      const target = exception.meta?.target;
      const email =
        target === 'email' ||
        (Array.isArray(target) && target.includes('email'));
      return res.status(HttpStatus.CONFLICT).json(
        jsonError(
          HttpStatus.CONFLICT,
          email ? 'EMAIL_TAKEN' : 'CONFLICT',
          email
            ? 'An account with this email already exists.'
            : 'This record already exists.',
          requestId,
        ),
      );
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();

      if (typeof raw === 'string') {
        return res
          .status(status)
          .json(jsonError(status, httpErrorName(status), raw, requestId));
      }

      const body = raw as Record<string, unknown>;
      const message = Array.isArray(body.message)
        ? String(body.message[0])
        : typeof body.message === 'string'
          ? body.message
          : exception.message;

      const errorCode =
        typeof body.error === 'string' &&
        body.error !== 'Bad Request' &&
        body.error !== 'Conflict' &&
        body.error !== 'Unauthorized' &&
        body.error !== 'Forbidden' &&
        body.error !== 'Not Found'
          ? body.error
          : status === HttpStatus.BAD_REQUEST
            ? 'VALIDATION_ERROR'
            : httpErrorName(status);

      return res
        .status(status)
        .json({
          ...jsonError(status, errorCode, message, requestId),
          ...loginIncompleteExtra(body),
        });
    }

    this.logger.error(
      `${req.method} ${req.originalUrl ?? req.url} 500 requestId=${requestId ?? '-'} ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
      exception instanceof Error ? exception.stack : undefined,
    );
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(
        jsonError(
          HttpStatus.INTERNAL_SERVER_ERROR,
          'INTERNAL_ERROR',
          'Unexpected error.',
          requestId,
        ),
      );
  }
}

function loginIncompleteExtra(body: Record<string, unknown>) {
  const extra: Record<string, unknown> = {};
  if (typeof body.accessToken === 'string') extra.accessToken = body.accessToken;
  if (typeof body.refreshToken === 'string') extra.refreshToken = body.refreshToken;
  if (body.user !== undefined) extra.user = body.user;
  if (Array.isArray(body.missing)) extra.missing = body.missing;
  if (typeof body.onboardingComplete === 'boolean') {
    extra.onboardingComplete = body.onboardingComplete;
  }
  return extra;
}

function jsonError(
  statusCode: number,
  error: string,
  message: string,
  requestId?: string,
) {
  return {
    statusCode,
    error,
    message,
    ...(requestId ? { requestId } : {}),
  };
}

function httpErrorName(status: number) {
  return HttpStatus[status] ?? 'ERROR';
}
