export type ChannelType = "sms" | "email" | "whatsapp" | "push";

export interface NotificationPayload {
  channel: ChannelType;
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  channel: ChannelType;
  error?: string;
}

export interface ChannelAdapter {
  readonly channel: ChannelType;
  send(payload: NotificationPayload): Promise<DeliveryResult>;
}

export interface AuthCredentials {
  type: "apiKey" | "clientSecret" | "bearer" | "basic";
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  token?: string;
}

export interface ProviderConfig {
  provider: string;
  channel: ChannelType;
  credentials: AuthCredentials;
  options?: Record<string, unknown>;
}
