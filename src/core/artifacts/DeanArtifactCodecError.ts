export class DeanArtifactCodecError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DeanArtifactCodecError';
  }
}
