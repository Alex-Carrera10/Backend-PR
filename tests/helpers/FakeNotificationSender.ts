import type { NotificationSender, NotificationPayload, NotificationResult } from '../../src/domain/ports/NotificationSender.js';

export class FakeNotificationSender implements NotificationSender {
  public calls: NotificationPayload[] = [];
  public queuedResults: NotificationResult[] = [];
  private defaultResult: NotificationResult = { ok: true, statusCode: 200, errorMessage: null };

  setDefaultResult(result: NotificationResult): void {
    this.defaultResult = result;
  }

  queueResult(result: NotificationResult): void {
    this.queuedResults.push(result);
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    this.calls.push(payload);
    return this.queuedResults.shift() ?? this.defaultResult;
  }

  reset(): void {
    this.calls = [];
    this.queuedResults = [];
    this.defaultResult = { ok: true, statusCode: 200, errorMessage: null };
  }
}
