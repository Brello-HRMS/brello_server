export enum FeedbackCategory {
  // FEEDBACK categories
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  SUGGESTION = 'SUGGESTION',
  PRAISE = 'PRAISE',

  // ISSUE_REPORT categories
  BUG = 'BUG',
  UI_UX = 'UI_UX',
  PERFORMANCE = 'PERFORMANCE',
  DATA_ISSUE = 'DATA_ISSUE',
}

export const FEEDBACK_CATEGORIES = [
  FeedbackCategory.FEATURE_REQUEST,
  FeedbackCategory.SUGGESTION,
  FeedbackCategory.PRAISE,
];

export const ISSUE_CATEGORIES = [
  FeedbackCategory.BUG,
  FeedbackCategory.UI_UX,
  FeedbackCategory.PERFORMANCE,
  FeedbackCategory.DATA_ISSUE,
];
