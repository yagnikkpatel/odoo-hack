import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "./logger";

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  attachments?: MailAttachment[];
};

export type MailTransport = "smtp" | "log";

let transporter: Transporter | null = null;

/** SMTP when configured; otherwise messages are logged and reported as not delivered. */
export function mailTransport(): MailTransport {
  return env.smtpHost ? "smtp" : "log";
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
    });
  }

  return transporter;
}

export async function sendMail(message: MailMessage): Promise<MailTransport> {
  if (mailTransport() === "log") {
    logger.info(
      {
        to: message.to,
        subject: message.subject,
        attachments: message.attachments?.map((item) => item.filename) ?? [],
      },
      "SMTP is not configured; email logged instead of sent",
    );

    return "log";
  }

  await getTransporter().sendMail({
    from: env.smtpFrom,
    to: message.to,
    subject: message.subject,
    text: message.text,
    attachments: message.attachments,
  });

  return "smtp";
}
