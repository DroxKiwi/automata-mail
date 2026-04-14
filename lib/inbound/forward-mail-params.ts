export type MailAttachmentInput = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type ForwardMailParams = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: MailAttachmentInput[];
};
