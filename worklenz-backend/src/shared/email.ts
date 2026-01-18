import nodemailer from "nodemailer";
import { Validator } from "jsonschema";
import { QueryResult } from "pg";
import { log_error, isValidateEmail } from "./utils";
import emailRequestSchema from "../json_schemas/email-request-schema";
import db from "../config/db";

export interface IEmail {
  to?: string[];
  subject: string;
  html: string;
}

export class EmailRequest implements IEmail {
  public readonly html: string;
  public readonly subject: string;
  public readonly to: string[];

  constructor(toEmails: string[], subject: string, content: string) {
    this.to = toEmails;
    this.subject = subject;
    this.html = content;
  }
}

function isValidMailBody(body: IEmail): boolean {
  const validator = new Validator();
  return validator.validate(body, emailRequestSchema).valid;
}

async function removeMails(query: string, emails: string[]) {
  const result: QueryResult<{ email: string }> = await db.query(query, []);
  const blockedEmails = result.rows.map(e => e.email);

  for (let i = emails.length - 1; i >= 0; i--) {
    if (blockedEmails.includes(emails[i])) {
      emails.splice(i, 1);
    }
  }
}

async function filterSpamEmails(emails: string[]): Promise<void> {
  await removeMails("SELECT email FROM spam_emails ORDER BY email;", emails);
}

async function filterBouncedEmails(emails: string[]): Promise<void> {
  await removeMails("SELECT email FROM bounced_emails ORDER BY email;", emails);
}

const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


export async function sendEmail(email: IEmail): Promise<string | null> {
  try {
    const options: IEmail = { ...email };

    // Remove duplicates
    options.to = Array.isArray(options.to)
      ? Array.from(new Set(options.to))
      : [];

    // Filter invalid emails
    options.to = options.to
      .filter(e => typeof e === "string" && e.trim().length > 0)
      .map(e => e.trim())
      .filter(e => isValidateEmail(e));

    if (options.to.length) {
      await filterBouncedEmails(options.to);
      await filterSpamEmails(options.to);
    }

    if (!options.to.length) return null;
    if (!isValidMailBody(options)) return null;

    const info = await mailTransporter.sendMail({
      from: `"TaskMate" <noreply@taskmate.com>`,
      to: options.to.join(","), // Nodemailer expects comma-separated
      subject: options.subject,
      html: options.html,
    });

    return info.messageId || null;
  } catch (error) {
    log_error(error);
    return null;
  }
}
