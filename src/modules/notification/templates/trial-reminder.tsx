import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';

import { BaseLayout } from './base-layout';

interface TrialReminderProps {
  organizationName: string;
  daysRemaining: number;
  trialEndDate: string;
  upgradeUrl?: string;
}

export function TrialReminderEmail({
  organizationName,
  daysRemaining,
  trialEndDate,
  upgradeUrl = 'https://app.brello.io/billing',
}: TrialReminderProps) {
  const urgency = daysRemaining === 1 ? 'last day' : `${daysRemaining} days`;

  return (
    <BaseLayout previewText={`Your Brello trial ends in ${urgency}`}>
      <Heading style={heading}>Your trial is ending soon</Heading>
      <Text style={body}>
        Hi there,
      </Text>
      <Text style={body}>
        Your <strong>{organizationName}</strong> trial expires on{' '}
        <strong>{trialEndDate}</strong> — that's {daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`}.
      </Text>
      <Text style={body}>
        Upgrade now to keep access to all your data, employees, and workflows without any interruption.
      </Text>

      <Section style={{ margin: '32px 0' }}>
        <Button href={upgradeUrl} style={ctaButton}>
          Upgrade to a paid plan
        </Button>
      </Section>

      <Text style={hint}>
        Questions? Reply to this email — our team is happy to help.
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
  margin: '0 0 12px',
};

const ctaButton: React.CSSProperties = {
  backgroundColor: '#3B82F6',
  color: '#FFFFFF',
  padding: '12px 24px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
};

const hint: React.CSSProperties = {
  fontSize: '13px',
  color: '#9CA3AF',
  margin: 0,
};
