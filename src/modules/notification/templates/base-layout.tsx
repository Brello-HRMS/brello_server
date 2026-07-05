import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface BaseLayoutProps {
  previewText: string;
  children?: React.ReactNode;
}

const brandColor = '#3B82F6';
const textColor = '#1F2937';
const mutedColor = '#6B7280';

export function BaseLayout({ previewText, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Logo / brand header */}
          <Section style={header}>
            <Text style={logoText}>Brello</Text>
          </Section>

          {/* Main content slot */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              You are receiving this email because you have an account with Brello.
            </Text>
            <Text style={footerText}>© {new Date().getFullYear()} Brello. All rights reserved.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: '#F9FAFB',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container: React.CSSProperties = {
  margin: '40px auto',
  maxWidth: '560px',
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  backgroundColor: brandColor,
  padding: '24px 32px',
};

const logoText: React.CSSProperties = {
  color: '#FFFFFF',
  fontSize: '24px',
  fontWeight: '700',
  margin: 0,
};

const content: React.CSSProperties = {
  padding: '32px',
  color: textColor,
};

const divider: React.CSSProperties = {
  borderColor: '#E5E7EB',
  margin: '0 32px',
};

const footer: React.CSSProperties = {
  padding: '16px 32px 24px',
};

const footerText: React.CSSProperties = {
  color: mutedColor,
  fontSize: '12px',
  margin: '4px 0',
};
