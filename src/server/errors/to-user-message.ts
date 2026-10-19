import { ZodError } from "zod";
import { ja } from "@/i18n/ja";

export type RuleViolation = {
  path?: string;
  message: string;
  ruleId?: string;
};

export class BusinessRuleError extends Error {
  readonly violations: RuleViolation[];
  readonly httpStatus: number;
  constructor(violations: RuleViolation[], httpStatus = 400) {
    super(violations.map((v) => v.message).join(" / "));
    this.violations = violations;
    this.httpStatus = httpStatus;
    this.name = "BusinessRuleError";
  }
}

export class ForbiddenError extends Error {
  readonly httpStatus = 403;
  constructor(message = ja.message.forbidden) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  readonly httpStatus = 401;
  constructor(message = ja.message.unauthorized) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends Error {
  readonly httpStatus = 404;
  constructor(message = ja.message.notFound) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  readonly httpStatus = 409;
  readonly code?: string;
  readonly extra?: Record<string, unknown>;
  constructor(
    message: string,
    options?: { code?: string; extra?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "ConflictError";
    if (options?.code !== undefined) this.code = options.code;
    if (options?.extra !== undefined) this.extra = options.extra;
  }
}

export type UserErrorEnvelope = {
  error: string;
  code?: string;
  violations?: RuleViolation[];
  extra?: Record<string, unknown>;
};

/**
 * あらゆる例外を、画面に出せる日本語メッセージへ変換する唯一の入口。
 * 英語の技術例外やスタックトレースを UI に露出させてはならない（憲法 I）。
 */
export function toUserError(err: unknown): {
  status: number;
  body: UserErrorEnvelope;
} {
  if (err instanceof BusinessRuleError) {
    return {
      status: err.httpStatus,
      body: {
        error: ja.message.invalidInput,
        violations: err.violations,
      },
    };
  }
  if (err instanceof ForbiddenError) {
    return { status: 403, body: { error: err.message } };
  }
  if (err instanceof UnauthorizedError) {
    return { status: 401, body: { error: err.message } };
  }
  if (err instanceof NotFoundError) {
    return { status: 404, body: { error: err.message } };
  }
  if (err instanceof ConflictError) {
    const body: UserErrorEnvelope = { error: err.message };
    if (err.code !== undefined) body.code = err.code;
    if (err.extra !== undefined) body.extra = err.extra;
    return { status: 409, body };
  }
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: ja.message.invalidInput,
        violations: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }
  // 想定外の例外は、画面にはシステム管理者宛てメッセージだけを返す。
  return {
    status: 500,
    body: { error: ja.message.serverError },
  };
}
