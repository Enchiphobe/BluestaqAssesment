export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string[]
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(errors: string[]) {
    super(400, "Validation failed", errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that") {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}
