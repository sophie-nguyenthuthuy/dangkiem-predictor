export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const Unauthorized = (message = 'Chưa đăng nhập') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const Forbidden = (message = 'Không đủ quyền truy cập') =>
  new AppError(403, 'FORBIDDEN', message);
export const NotFound = (message = 'Không tìm thấy') => new AppError(404, 'NOT_FOUND', message);
export const Conflict = (message: string) => new AppError(409, 'CONFLICT', message);
export const UnprocessableEntity = (message: string, details?: unknown) =>
  new AppError(422, 'UNPROCESSABLE_ENTITY', message, details);
export const Internal = (message = 'Lỗi hệ thống') => new AppError(500, 'INTERNAL', message);
