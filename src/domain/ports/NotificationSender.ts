export interface NotificationPayload {
  taskId: number;
  title: string;
  archivedAt: string;
}

export interface NotificationResult {
  ok: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

export interface NotificationSender {
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
