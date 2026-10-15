import { Injectable, Logger } from "@nestjs/common";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async send(message: MailMessage) {
    const provider =
      process.env.EMAIL_PROVIDER ?? "console";

    if (provider === "console") {
      this.logger.log(
        `[DEV MAIL] To=${message.to} Subject="${message.subject}"\n${message.text}`,
      );

      return {
        provider: "console",
        accepted: true,
      };
    }

    /**
     * Provider adapters intentionally stay outside the core domain.
     * Add Resend, Postmark, SES, Brevo, etc. later.
     */
    throw new Error(
      `EMAIL_PROVIDER=${provider} is not configured.`,
    );
  }
}
