/**
 * Test Logger Utility
 * Captures all logs and writes them to a file when a test fails
 * Reduces console noise during test runs
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_FILE = join(__dirname, 'test-failures.log');

let logs: string[] = [];
let isCapturing = true;
let currentTestName: string = '';

/**
 * Initialize the log file (clear previous content)
 */
export function initLogFile(): void {
  try {
    writeFileSync(LOG_FILE, `Test Failures Log - ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`, 'utf8');
  } catch (error) {
    // Silently fail if we can't write
  }
}

/**
 * Set the current test name for better log organization
 */
export function setTestName(name: string): void {
  currentTestName = name;
}

/**
 * Capture a log message (buffered, not printed until printLogs() is called)
 * Usage - testLog('Signup data prepared', { email: testUserEmail, role: TEACHER_ROLE });
 */
export function testLog(message: string, data?: any): void {
  if (isCapturing) {
    const formatted = data ? `${message}: ${JSON.stringify(data, null, 2)}` : message;
    const logEntry = `[TEST-LOG] ${formatted}`;
    logs.push(logEntry);
  }
}

/**
 * Capture an error message
 */
export function testError(message: string, error?: any): void {
  if (isCapturing) {
    const formatted = error ? `${message}: ${JSON.stringify(error, null, 2)}` : message;
    logs.push(`[ERROR] ${formatted}`);
  }
}

/**
 * Write all captured logs to file (call this on test failure)
 */
export function printLogs(): void {
  if (logs.length > 0) {
    try {
      const timestamp = new Date().toISOString();
      const testHeader = currentTestName ? `\n[FAILED TEST: ${currentTestName}]` : '\n[FAILED TEST]';
      const logContent = [
        testHeader,
        `[Timestamp: ${timestamp}]`,
        '='.repeat(80),
        ...logs,
        '='.repeat(80),
        '\n'
      ].join('\n');
      
      appendFileSync(LOG_FILE, logContent, 'utf8');
    } catch (error) {
      // Silently fail if we can't write
      console.error('Failed to write test logs:', error);
    }
  }
}

/**
 * Clear logs for next test
 */
export function clearLogs(): void {
  logs = [];
}

/**
 * Get all captured logs
 */
export function getLogs(): string[] {
  return [...logs];
}

/**
 * Stop capturing logs
 */
export function stopCapturing(): void {
  isCapturing = false;
}

/**
 * Start capturing logs
 */
export function startCapturing(): void {
  isCapturing = true;
}

