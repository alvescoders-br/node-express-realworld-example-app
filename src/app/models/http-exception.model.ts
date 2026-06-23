export type HttpExceptionResponse = string | Record<string, unknown>;

class HttpException extends Error {
  errorCode: number;
  readonly response: HttpExceptionResponse;

  constructor(errorCode: number, response: HttpExceptionResponse) {
    super(typeof response === 'string' ? response : JSON.stringify(response));
    this.errorCode = errorCode;
    this.response = response;
  }
}

export default HttpException;
