import { ZodError, type ZodType } from "zod";

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "VERIFICATION_REQUIRED",
  "POLICY_VIOLATION",
  "PAYMENT_REQUIRED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS_FOR_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  VERIFICATION_REQUIRED: 403,
  POLICY_VIOLATION: 422,
  PAYMENT_REQUIRED: 402,
  INTERNAL: 500,
};

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string[]>;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta: { requestId: string } & Record<string, unknown>;
  error: null;
}

export interface ApiFailure {
  ok: false;
  data: null;
  meta: { requestId: string };
  error: ApiErrorBody;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fields?: Record<string, string[]>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function errorClass(code: ErrorCode) {
  const status = STATUS_FOR_CODE[code];
  return class extends HttpError {
    constructor(message: string, fields?: Record<string, string[]>) {
      super(status, code, message, fields);
      this.name = code;
    }
  };
}

export const ValidationError = errorClass("VALIDATION_ERROR");
export const UnauthorizedError = errorClass("UNAUTHORIZED");
export const ForbiddenError = errorClass("FORBIDDEN");
export const NotFoundError = errorClass("NOT_FOUND");
export const ConflictError = errorClass("CONFLICT");
export const RateLimitedError = errorClass("RATE_LIMITED");
export const VerificationRequiredError = errorClass("VERIFICATION_REQUIRED");
export const PolicyViolationError = errorClass("POLICY_VIOLATION");
export const PaymentRequiredError = errorClass("PAYMENT_REQUIRED");
export const InternalError = errorClass("INTERNAL");

export function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

export function success<T>(
  data: T,
  requestId: string,
  meta: Record<string, unknown> = {},
): ApiSuccess<T> {
  return { ok: true, data, meta: { requestId, ...meta }, error: null };
}

export function failure(error: ApiErrorBody, requestId: string): ApiFailure {
  return { ok: false, data: null, meta: { requestId }, error };
}

export function requestIdFrom(request: Request): string {
  const header = request.headers.get("x-request-id");
  if (header && header.trim()) return header.trim();
  return crypto.randomUUID();
}

export function zodFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "body";
    fields[key] ??= [];
    fields[key].push(issue.message);
  }
  return fields;
}

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid request", zodFields(parsed.error));
  }
  return parsed.data;
}

function statusFor(error: unknown): number {
  if (error instanceof HttpError) return error.status;
  if (error instanceof ZodError) return 400;
  return 500;
}

function bodyFor(error: unknown, id: string): ApiFailure {
  if (error instanceof ZodError) {
    return failure(
      { code: "VALIDATION_ERROR", message: "Invalid request", fields: zodFields(error) },
      id,
    );
  }
  if (error instanceof HttpError) {
    return failure({ code: error.code, message: error.message, fields: error.fields }, id);
  }
  console.error("request.failed", { requestId: id });
  return failure({ code: "INTERNAL", message: "Internal error" }, id);
}

/** Next.js route-handler wrapper. The function returns a Response or throws. */
export function handle(fn: (request: Request) => Promise<Response> | Response) {
  return async (request: Request): Promise<Response> => {
    const id = requestIdFrom(request);
    try {
      return await fn(request);
    } catch (error) {
      return Response.json(bodyFor(error, id), {
        status: statusFor(error),
        headers: { "x-request-id": id },
      });
    }
  };
}
