export interface YeelightDeviceError {
  code: number;
  message: string;
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
