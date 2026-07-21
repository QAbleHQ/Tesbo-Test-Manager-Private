import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        response.status(status).json({ error: body });
      } else {
        response.status(status).json(body);
      }
      return;
    }
    const payloadError = exception as { type?: string; status?: number; limit?: number } | null;
    if (payloadError?.type === "entity.too.large") {
      const limit = typeof payloadError.limit === "number" ? formatBytes(payloadError.limit) : "the configured limit";
      response
        .status(HttpStatus.PAYLOAD_TOO_LARGE)
        .json({ error: `This request is too large. Maximum supported size is ${limit}.` });
      return;
    }
    console.error("Unhandled exception:", exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
}
