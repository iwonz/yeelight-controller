export interface YeelightDeviceError {
  code: number;
  message: string;
}

export class YeelightNotConnectedError extends Error {
  constructor() {
    super('Yeelight device is not connected');
    this.name = 'YeelightNotConnectedError';
    Object.setPrototypeOf(this, YeelightNotConnectedError.prototype);
  }
}

export class YeelightConnectionClosedError extends Error {
  public readonly cause?: Error;

  constructor(cause?: Error) {
    super(cause ? `Yeelight connection closed: ${cause.message}` : 'Yeelight connection closed');
    this.name = 'YeelightConnectionClosedError';
    this.cause = cause;
    Object.setPrototypeOf(this, YeelightConnectionClosedError.prototype);
  }
}

export class YeelightCommandTimeoutError extends Error {
  public readonly commandId: number;
  public readonly method: string;
  public readonly timeout: number;

  constructor(commandId: number, method: string, timeout: number) {
    super(`Yeelight command ${method} (${commandId}) timed out after ${timeout}ms`);
    this.name = 'YeelightCommandTimeoutError';
    this.commandId = commandId;
    this.method = method;
    this.timeout = timeout;
    Object.setPrototypeOf(this, YeelightCommandTimeoutError.prototype);
  }
}

export class YeelightDuplicateCommandIdError extends Error {
  public readonly commandId: number;

  constructor(commandId: number) {
    super(`Yeelight command id ${commandId} is already pending`);
    this.name = 'YeelightDuplicateCommandIdError';
    this.commandId = commandId;
    Object.setPrototypeOf(this, YeelightDuplicateCommandIdError.prototype);
  }
}

export class YeelightValidationError extends TypeError {
  public readonly field: string;

  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'YeelightValidationError';
    this.field = field;
    Object.setPrototypeOf(this, YeelightValidationError.prototype);
  }
}

export class YeelightProtocolError extends Error {
  public readonly code: number;
  public readonly commandId: number;

  constructor(commandId: number, error: YeelightDeviceError) {
    super(error.message);
    this.name = 'YeelightProtocolError';
    this.code = error.code;
    this.commandId = commandId;
    Object.setPrototypeOf(this, YeelightProtocolError.prototype);
  }
}
