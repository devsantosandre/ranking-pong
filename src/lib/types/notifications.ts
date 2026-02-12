export type PendingNotificationEvent =
  | "pending_created"
  | "pending_transferred"
  | "pending_resolved";

export type PendingNotificationStatus =
  | "pendente"
  | "edited"
  | "validado"
  | "cancelado";

export type PendingNotificationPayloadV1 = {
  event: PendingNotificationEvent;
  match_id: string;
  status: PendingNotificationStatus;
  actor_id: string;
  actor_name: string | null;
  created_by: string;
};
