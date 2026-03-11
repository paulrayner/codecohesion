export interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export const silentLogger: Logger = {
  log: () => {},
  warn: () => {},
  error: () => {},
};

export const consoleLogger: Logger = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};
