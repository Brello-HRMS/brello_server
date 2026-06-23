export enum FeedbackStatus {
  // Shared initial state
  SUBMITTED = 'SUBMITTED',

  // Feedback-track statuses
  UNDER_REVIEW = 'UNDER_REVIEW',
  PLANNED = 'PLANNED',
  DECLINED = 'DECLINED',
  RELEASED = 'RELEASED',

  // Issue-track statuses
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

// Valid transitions per status — Platform Admin only
export const VALID_TRANSITIONS: Record<FeedbackStatus, FeedbackStatus[]> = {
  [FeedbackStatus.SUBMITTED]: [
    FeedbackStatus.UNDER_REVIEW,
    FeedbackStatus.ACKNOWLEDGED,
  ],
  [FeedbackStatus.UNDER_REVIEW]: [
    FeedbackStatus.PLANNED,
    FeedbackStatus.DECLINED,
  ],
  [FeedbackStatus.PLANNED]: [FeedbackStatus.RELEASED],
  [FeedbackStatus.DECLINED]: [],
  [FeedbackStatus.RELEASED]: [],
  [FeedbackStatus.ACKNOWLEDGED]: [FeedbackStatus.IN_PROGRESS],
  [FeedbackStatus.IN_PROGRESS]: [FeedbackStatus.RESOLVED],
  [FeedbackStatus.RESOLVED]: [FeedbackStatus.CLOSED],
  [FeedbackStatus.CLOSED]: [],
};
