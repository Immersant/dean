export class SessionSectionValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SessionSectionValidationError';
  }
}
