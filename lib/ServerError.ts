export default class ServerError extends Error {
  private readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }

  public getStatusCode(): number {
    return this.statusCode;
  }
}
