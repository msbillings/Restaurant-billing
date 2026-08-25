export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Indicates it is a trusted, known error we threw

    // Capture stack trace, excluding the constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}
