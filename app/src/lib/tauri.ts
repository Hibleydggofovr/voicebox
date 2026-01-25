/**
 * Tauri integration utilities
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

/**
 * Start the bundled Python server (Tauri only)
 */
export async function startServer(remote = false): Promise<string> {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment');
  }

  try {
    const result = await invoke<string>('start_server', { remote });
    console.log('Server started:', result);
    return result;
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

/**
 * Stop the bundled Python server (Tauri only)
 */
export async function stopServer(): Promise<void> {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment');
  }

  try {
    await invoke('stop_server');
    console.log('Server stopped');
  } catch (error) {
    console.error('Failed to stop server:', error);
    throw error;
  }
}
