import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';

import { BaseLayout } from './base-layout';

export type OtpPurpose = 'login' | 'password-reset' | 'signup';

interface OtpEmailProps {
  otp: string;
  purpose: OtpPurpose;
  expiresInMinutes: number;
}

const purposeLabel: Record<OtpPurpose, string> = {
  login: 'log in to your account',
  'password-reset': 'reset your password',
  signup: 'verify your email address',
};

export function OtpEmail({ otp, purpose, expiresInMinutes }: OtpEmailProps) {
  return (
    <BaseLayout previewText={`Your Brello OTP: ${otp}`}>
      <Heading style={heading}>Your one-time password</Heading>
      <Text style={body}>
        Use the code below to {purposeLabel[purpose]}. It expires in{' '}
        <strong>{expiresInMinutes} minutes</strong>.
      </Text>

      <Section style={otpBox}>
        <Text style={otpCode}>{otp}</Text>
      </Section>

      <Text style={hint}>
        If you didn't request this code, you can safely ignore this email.
      </Text>
    </BaseLayout>
  );
}

const heading: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: '700',
  color: '#1F2937',
  margin: '0 0 16px',
};

const body: React.CSSProperties = {
  fontSize: '15px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 24px',
};

const otpBox: React.CSSProperties = {
  background: '#F3F4F6',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center',
  margin: '0 0 24px',
};

const otpCode: React.CSSProperties = {
  fontSize: '36px',
  fontWeight: '700',
  letterSpacing: '8px',
  color: '#1D4ED8',
  margin: 0,
};

const hint: React.CSSProperties = {
  fontSize: '13px',
  color: '#9CA3AF',
  margin: 0,
};
