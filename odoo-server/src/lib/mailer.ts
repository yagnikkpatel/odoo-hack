import nodemailer, { Transporter } from "nodemailer";
import { env, isSmtpConfigured } from "../config/env";
import { AppError } from "../errors/AppError";
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
  html?: string;
  attachments?: MailAttachment[];
};

let transporter: Transporter | null = null;

/**
 * One pooled transport for the whole process. Pooling matters here: a payrun
 * sends one message per employee, and reconnecting for each of them is what
 * gets an account rate limited.
 */
function getTransporter(): Transporter {
  if (!isSmtpConfigured) {
    throw new AppError(
      503,
      "Email delivery is not configured. Set the SMTP variables and restart the payslip email worker.",
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: { user: env.smtpUser, pass: env.smtpPassword },
      pool: true,
      maxConnections: env.smtpMaxConnections,
      maxMessages: 50,
      rateDelta: 1000,
      rateLimit: env.smtpMessagesPerSecond,
    });
  }

  return transporter;
}

export async function verifyMailer(): Promise<boolean> {
  if (!isSmtpConfigured) {
    logger.warn(
      "SMTP is not configured -- payslip emails will fail until it is set",
    );

    return false;
  }

  try {
    await getTransporter().verify();

    logger.info(
      { host: env.smtpHost, port: env.smtpPort, user: env.smtpUser },
      "SMTP connection verified",
    );

    return true;
  } catch (error) {
    logger.error({ err: error }, "SMTP verification failed");

    return false;
  }
}

export async function sendMail(message: MailMessage): Promise<string> {
  const info = await getTransporter().sendMail({
    from: { name: env.smtpFromName, address: env.smtpFromEmail },
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
  });

  return info.messageId;
}

export async function closeMailer(): Promise<void> {
  transporter?.close();
  transporter = null;
}

/**
 * Deliberately stricter than the RFC: it rejects the display-name and routing
 * forms an SMTP header would otherwise accept, so a stored address cannot
 * inject a second recipient.
 */
const EMAIL_PATTERN = /^[^\s@<>,;:"\\[\]\r\n]+@[^\s@<>,;:"\\[\]\r\n]+\.[a-z]{2,}$/i;

export function isValidEmail(value: string | null | undefined): boolean {
  return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value);
}
