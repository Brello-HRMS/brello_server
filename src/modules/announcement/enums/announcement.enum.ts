export enum AnnouncementStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum AnnouncementPriority {
  NORMAL = 'NORMAL',
  IMPORTANT = 'IMPORTANT',
  URGENT = 'URGENT',
}

export enum AnnouncementPublishType {
  INSTANT = 'INSTANT',
  SCHEDULED = 'SCHEDULED',
}

export enum AnnouncementTargetType {
  ALL = 'ALL',
  DEPARTMENT = 'DEPARTMENT',
  LOCATION = 'LOCATION',
  EMPLOYEE = 'EMPLOYEE',
}
