import type { NotificationSender, NotificationPayload, NotificationResult } from '../../domain/ports/NotificationSender.js';

const REQUEST_TIMEOUT_MS = 5000;

export class HttpNotificationSender implements NotificationSender {
  constructor(private readonly notifyUrl: string) {}

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(this.notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const ok = response.status < 500;
      return { ok, statusCode: response.status, errorMessage: ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      return { ok: false, statusCode: null, errorMessage: message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
