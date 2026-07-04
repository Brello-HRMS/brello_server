export const QUEUE_NAMES = {
  EMAIL: 'brello:notifications:email',
  EMAIL_DLQ: 'brello:notifications:email-dlq',
  IN_APP: 'brello:notifications:in-app',
  IN_APP_DLQ: 'brello:notifications:in-app-dlq',
  PUSH: 'brello:notifications:push',
  PUSH_DLQ: 'brello:notifications:push-dlq',
} as const;

export const QUEUE_TOKENS = {
  EMAIL: 'BULLMQ_EMAIL_QUEUE',
  EMAIL_DLQ: 'BULLMQ_EMAIL_DLQ',
  IN_APP: 'BULLMQ_IN_APP_QUEUE',
  IN_APP_DLQ: 'BULLMQ_IN_APP_DLQ',
  PUSH: 'BULLMQ_PUSH_QUEUE',
  PUSH_DLQ: 'BULLMQ_PUSH_DLQ',
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true,
  removeOnFail: false,
} as const;
