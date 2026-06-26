import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class EmailService {
  constructor(private readonly config: AppConfigService) {}

  async sendInvite(
    to: string,
    inviterName: string,
    role: string,
    workspaceName: string,
    rawToken: string,
    projectNames: string[],
    frontendUrl: string
  ): Promise<void> {
    const acceptUrl = `${frontendUrl}/invite/${rawToken}`;
    const roleLabel = role === "manager" ? "Manager" : "QA Engineer";
    const projectLine =
      projectNames.length > 0
        ? `\nYou have been assigned to: ${projectNames.join(", ")}.`
        : "";
    const textBody = `Hi,\n\n${inviterName} has invited you to join ${workspaceName} as ${roleLabel}.${projectLine}\n\nAccept your invitation here:\n${acceptUrl}\n\nThis invite expires in 7 days.\n\nTesbo Test Manager`;
    const htmlBody = `<p>Hi,</p>
<p><strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> as <strong>${roleLabel}</strong>.</p>
${projectNames.length > 0 ? `<p>You have been assigned to: ${projectNames.map((n) => `<em>${n}</em>`).join(", ")}.</p>` : ""}
<p><a href="${acceptUrl}" style="display:inline-block;padding:10px 20px;background:#E8600A;color:#fff;text-decoration:none;border-radius:6px">Accept invite</a></p>
<p style="color:#6B7280;font-size:12px">This invite expires in 7 days. If you did not expect this, you can ignore it.</p>`;

    if (!this.config.postmarkApiToken) {
      console.log(`[INVITE] ${to} → ${acceptUrl}`);
      return;
    }
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.config.postmarkApiToken
      },
      body: JSON.stringify({
        From: this.config.postmarkFromEmail,
        To: to,
        Subject: `You have been invited to join ${workspaceName}`,
        TextBody: textBody,
        HtmlBody: htmlBody
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Postmark returned ${response.status}: ${body}`);
    }
  }

  async sendOtp(to: string, code: string): Promise<void> {
    if (!this.config.postmarkApiToken) {
      console.log(`OTP for ${to}: ${code}`);
      return;
    }
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.config.postmarkApiToken
      },
      body: JSON.stringify({
        From: this.config.postmarkFromEmail,
        To: to,
        Subject: "Your Tesbo Test Manager verification code",
        TextBody: `Your Tesbo Test Manager verification code is ${code}. It expires in ${this.config.otpExpiryMinutes} minutes.`
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Postmark returned ${response.status}: ${body}`);
    }
  }
}
