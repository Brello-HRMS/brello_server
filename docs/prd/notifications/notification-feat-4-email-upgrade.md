# Feature 4 — Email Upgrade: Resend + React Email Templates

> Phase 4 of the notification build plan. Replaces raw nodemailer/SMTP with Resend and proper HTML templates written as React components.

---

## Goal

Emails should be reliable, deliverable, branded, and maintainable. The current implementation (`<p>${dto.message}</p>` via SMTP) has no deliverability guarantees, no bounce tracking, and no design.

---

## Why Resend

- TypeScript-first SDK, minimal config
- Free tier: 3,000 emails/month (100/day) — covers MVP
- Webhooks for bounces, complaints, opens, clicks
- Officially built for React Email integration
- Alternatives ruled out: SendGrid (complex, overkill), Postmark (more expensive, better for transactional at scale), raw SMTP (fragile, spam risk)

---

## Why React Email

- Templates are `.tsx` files — same toolchain, TypeScript, component reuse
- Renders to battle-tested HTML + plain-text at the same time
- `@react-email/render` renders server-side, no build step required at runtime

---

## Scope

### Server (brello_server)

**1. Install packages**

```bash
npm install resend @react-email/render @react-email/components
```

**2. Email templates**

```
src/modules/notification/templates/
  ├── base-layout.tsx        — shared wrapper (logo, footer, brand colors)
  ├── otp-email.tsx          — used by AuthService (login OTP, forgot password OTP, resend OTP)
  └── trial-reminder.tsx     — used by TrialReminderCron (7 / 3 / 1 day warnings)
```

Each template accepts typed props and returns a React Email component. Example:

```typescript
// otp-email.tsx
interface OtpEmailProps {
  otp: string;
  purpose: 'login' | 'password-reset' | 'signup';
  expiresInMinutes: number;
}

export function OtpEmail({ otp, purpose, expiresInMinutes }: OtpEmailProps) {
  return (
    <BaseLayout>
      <Heading>Your one-time password</Heading>
      <Text>Use the code below to {purposeLabel[purpose]}. It expires in {expiresInMinutes} minutes.</Text>
      <Section style={otpBoxStyle}>
        <Text style={otpStyle}>{otp}</Text>
      </Section>
    </BaseLayout>
  );
}
```

**3. Replace EmailNotificationService**

Current: creates a nodemailer transport, calls `transport.sendMail()`

New:
```typescript
import { Resend } from 'resend';
import { render } from '@react-email/render';

// In send():
const html = await render(<OtpEmail otp={dto.metadata.otp} purpose={dto.metadata.purpose} expiresInMinutes={10} />);
await this.resend.emails.send({
  from: this.configService.get('resend.from'),  // e.g. "Brello <noreply@brello.io>"
  to: dto.target_email,
  subject: dto.title,
  html,
});
```

The service stays behind the same interface — only the internals change. BullMQ workers call it the same way.

**4. Wire TrialReminderCron**

File: `src/modules/billing/crons/trial-reminder.cron.ts`

Currently logs only (TODO comment at line 39). Wire it to call `NotificationService.send()` with `type: EMAIL` and `template: 'trial-reminder'` for each org admin. Requires resolving org admin user(s) — look up users with admin role for the org.

**5. Wire forgot password OTP**

File: `src/modules/auth/services/auth.service.ts`, line 539

Currently: `console.log(otp)`. Replace with:
```typescript
await this.notificationService.send({
  target_email: user.email,
  title: 'Reset your password',
  message: otp,
  type: NotificationType.EMAIL,
  metadata: { otp, purpose: 'password-reset', expiresInMinutes: 10 }
});
```

**6. Config additions**

```
resend:
  api_key: string   (from RESEND_API_KEY env var)
  from: string      (e.g. "Brello <noreply@brello.io>")
```

Remove SMTP config once Resend is working.

---

### Web App

No changes in this phase.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/modules/notification/templates/base-layout.tsx` | New |
| `src/modules/notification/templates/otp-email.tsx` | New |
| `src/modules/notification/templates/trial-reminder.tsx` | New |
| `src/modules/notification/services/email-notification.service.ts` | Replace nodemailer with Resend |
| `src/modules/billing/crons/trial-reminder.cron.ts` | Wire NotificationService (remove TODO) |
| `src/modules/auth/services/auth.service.ts` | Fix forgot-password OTP send (line 539) |
| `src/config/` | Add resend config, remove smtp config |
| `package.json` | Add resend, @react-email/render, @react-email/components |

---

## Done When

- [ ] OTP emails arrive in inbox (not spam) with branded HTML layout
- [ ] Trial reminder emails send at T-7, T-3, T-1 days with correct copy
- [ ] Forgot password flow sends email (no longer just logs to console)
- [ ] nodemailer and SMTP config fully removed
- [ ] Email sends through BullMQ queue (Phase 3 prerequisite) — failures are retried
