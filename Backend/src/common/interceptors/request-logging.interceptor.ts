import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const path = req.originalUrl ?? req.url;

    if (
      process.env.NODE_ENV === 'test' ||
      path === '/health' ||
      path === '/ready' ||
      path.startsWith('/health?') ||
      path.startsWith('/ready?')
    ) {
      return next.handle();
    }
    const started = Date.now();
res.on('finish', () => {
  const requestId = req.header(REQUEST_ID_HEADER) ?? '-';
  this.logger.log(
    `${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms requestId=${requestId}`,
  );
});

    return next.handle();
  }
}
