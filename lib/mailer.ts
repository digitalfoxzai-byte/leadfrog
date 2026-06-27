import nodemailer from 'nodemailer'
import { query } from '@/lib/db'

export interface MailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

export async function getSmtpSettings() {
  const rows = await query<{ key: string; value: string }[]>(
    "SELECT `key`, `value` FROM settings WHERE `key` IN ('smtp_host','smtp_port','smtp_secure','smtp_user','smtp_pass','smtp_from_name','smtp_from_email','admin_email')"
  ).catch(() => [] as { key: string; value: string }[])

  const get = (k: string) => rows.find(r => r.key === k)?.value || ''

  const host       = get('smtp_host')      || process.env.SMTP_HOST      || ''
  const user       = get('smtp_user')      || process.env.SMTP_USER      || ''
  const pass       = get('smtp_pass')      || process.env.SMTP_PASS      || ''
  const fromName   = get('smtp_from_name') || process.env.SMTP_FROM_NAME || 'LeadFrog'
  const fromEmail  = get('smtp_from_email')|| process.env.SMTP_FROM_EMAIL|| user
  const adminEmail = get('admin_email')    || process.env.ADMIN_EMAIL    || fromEmail
  const port       = parseInt(get('smtp_port') || process.env.SMTP_PORT || '465', 10)
  const secure     = get('smtp_secure') !== '' ? get('smtp_secure') === '1' : port === 465

  if (!host || !user || !pass) return null
  return { host, port, secure, user, pass, fromName, fromEmail, adminEmail }
}

export function emailTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
  <tr><td style="background:#16A34A;padding:20px 32px;">
    <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:-0.3px;">🐸 LeadFrog</span>
    <span style="color:rgba(255,255,255,0.75);font-size:13px;margin-left:8px;">Lead Intelligence Platform</span>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="color:#0F172A;margin:0 0 16px;font-size:20px;font-weight:700;">${title}</h2>
    <div style="color:#475569;font-size:14px;line-height:1.75;">${bodyHtml}</div>
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #E2E8F0;background:#F8FAFC;">
    <p style="color:#94A3B8;font-size:12px;margin:0;">LeadFrog &middot; Lead Intelligence Platform</p>
    <p style="color:#CBD5E1;font-size:11px;margin:4px 0 0;">You received this because you have an account with LeadFrog. If this wasn't you, please ignore this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

export async function sendAdminMail(subject: string, html: string): Promise<boolean> {
  const cfg = await getSmtpSettings()
  if (!cfg || !cfg.adminEmail) return false
  return sendMailWithConfig(cfg, cfg.adminEmail, subject, html)
}

type SmtpConfig = NonNullable<Awaited<ReturnType<typeof getSmtpSettings>>>

async function sendMailWithConfig(
  cfg: SmtpConfig, to: string, subject: string, html: string, attachments?: MailAttachment[]
): Promise<boolean> {
  try {
    const text = html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ').trim()

    const transport = nodemailer.createTransport({
      host: cfg.host, port: cfg.port, secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    })
    await transport.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to, subject, html, text,
      replyTo: cfg.fromEmail,
      attachments,
      headers: {
        'X-Mailer': 'LeadFrog Mailer',
        'X-Entity-Ref-ID': `leadfrog-${Date.now()}`,
        'List-Unsubscribe': `<mailto:${cfg.fromEmail}?subject=unsubscribe>`,
        'Precedence': 'bulk',
      },
    })
    return true
  } catch (err) {
    console.error('[LeadFrog mailer] sendMail failed:', err)
    return false
  }
}

export async function sendMail(
  to: string, subject: string, html: string, attachments?: MailAttachment[]
): Promise<boolean> {
  const cfg = await getSmtpSettings()
  if (!cfg) {
    console.warn('[LeadFrog mailer] SMTP not configured — skipped:', subject)
    return false
  }
  return sendMailWithConfig(cfg, to, subject, html, attachments)
}
