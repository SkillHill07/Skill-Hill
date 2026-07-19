import nodemailer from "nodemailer"
import { config } from "../config/index.js"

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    // Dev mode with no email configured — log to console instead of sending
    if (
      config.NODE_ENV === "development" &&
      !config.EMAIL_USER &&
      !config.EMAIL_APP_PASSWORD
    ) {
      transporter = nodemailer.createTransport({ name: "localhost" })
      transporter.sendMail = async (mailOptions) => {
        console.log("\n--- DEV EMAIL (not sent) ---")
        console.log(`From:    ${mailOptions.from}`)
        console.log(`To:      ${mailOptions.to}`)
        console.log(`Subject: ${mailOptions.subject}`)
        console.log(`Body:\n${mailOptions.html || mailOptions.text}`)
        console.log("--- END DEV EMAIL ---\n")
        return {
          messageId: `dev-${Date.now()}@localhost`,
          accepted: [mailOptions.to as string],
          rejected: [],
          pending: [],
          envelope: { from: "" as string, to: [mailOptions.to as string] },
        }
      }
      return transporter
    }

    // Real SMTP — Gmail app passwords work with smtp.gmail.com:587
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_APP_PASSWORD,
      },
    })
  }

  return transporter
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transport = getTransporter()
  const from = config.SMTP_FROM || config.EMAIL_USER || "noreply@skillsarena.com"

  await transport.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  })
}
