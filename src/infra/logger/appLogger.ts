import { createConsoleWriter } from './createConsoleWriter.ts';
import { createLogger } from './createLogger.ts';

export const logger = createLogger([createConsoleWriter()]);
