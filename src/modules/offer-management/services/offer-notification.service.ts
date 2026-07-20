import { Injectable } from '@nestjs/common';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { NotificationEventType } from '../../../common/enums/notification-event-type.enum';
import type { Offer } from '../entities/offer.entity';
import type { OfferCandidate } from '../entities/offer-candidate.entity';

/** HR receives these for actions the candidate takes. */
interface HrNotificationPayload {
  hrUserId: string;
  offer: Offer;
  candidate: OfferCandidate;
}

/** Candidate receives these by email (no user_id — not a platform user). */
interface CandidateEmailPayload {
  candidate: OfferCandidate;
  offer: Offer;
  portalLink: string;
}

@Injectable()
export class OfferNotificationService {
  constructor(private readonly notificationService: NotificationService) {}

  async notifyHrOfferViewed(payload: HrNotificationPayload): Promise<void> {
    await this.notificationService.send({
      user_id: payload.hrUserId,
      title: 'Offer Viewed',
      message: `${this.candidateName(payload.candidate)} has viewed the offer.`,
      type: NotificationType.IN_APP,
      event_type: NotificationEventType.OFFER_VIEWED,
    });
  }

  async notifyHrOfferAccepted(payload: HrNotificationPayload): Promise<void> {
    await this.notificationService.broadcastAllChannels({
      user_id: payload.hrUserId,
      title: 'Offer Accepted 🎉',
      message: `${this.candidateName(payload.candidate)} has accepted the offer (${payload.offer.offer_number}).`,
      event_type: NotificationEventType.OFFER_ACCEPTED,
    });
  }

  async notifyHrOfferRejected(payload: HrNotificationPayload): Promise<void> {
    await this.notificationService.broadcastAllChannels({
      user_id: payload.hrUserId,
      title: 'Offer Rejected',
      message: `${this.candidateName(payload.candidate)} has rejected the offer (${payload.offer.offer_number}).`,
      event_type: NotificationEventType.OFFER_REJECTED,
    });
  }

  async notifyHrChangeRequested(payload: HrNotificationPayload): Promise<void> {
    await this.notificationService.broadcastAllChannels({
      user_id: payload.hrUserId,
      title: 'Negotiation Requested',
      message: `${this.candidateName(payload.candidate)} has requested changes to the offer.`,
      event_type: NotificationEventType.OFFER_CHANGE_REQUESTED,
    });
  }

  async sendOfferEmail(payload: CandidateEmailPayload): Promise<void> {
    await this.notificationService.send({
      target_email: payload.candidate.email,
      title: `Your Offer Letter from ${payload.offer.position ?? 'our company'}`,
      message: this.buildOfferEmailBody(payload),
      type: NotificationType.EMAIL,
      event_type: NotificationEventType.OFFER_SENT,
      metadata: { offer_number: payload.offer.offer_number, portal_link: payload.portalLink },
    });
  }

  async sendReminderEmail(payload: CandidateEmailPayload): Promise<void> {
    await this.notificationService.send({
      target_email: payload.candidate.email,
      title: 'Reminder: Please respond to your offer',
      message: `Your offer (${payload.offer.offer_number}) is expiring soon. Please log in to respond.`,
      type: NotificationType.EMAIL,
      event_type: NotificationEventType.OFFER_REMINDER,
      metadata: { portal_link: payload.portalLink },
    });
  }

  async sendWithdrawEmail(payload: CandidateEmailPayload): Promise<void> {
    await this.notificationService.send({
      target_email: payload.candidate.email,
      title: 'Your Offer Has Been Withdrawn',
      message: `We regret to inform you that offer ${payload.offer.offer_number} has been withdrawn.`,
      type: NotificationType.EMAIL,
      event_type: NotificationEventType.OFFER_WITHDRAWN,
    });
  }

  async sendAcceptanceConfirmationEmail(
    payload: CandidateEmailPayload & { acceptedPdfUrl?: string },
  ): Promise<void> {
    const message = payload.acceptedPdfUrl
      ? [
          `Thank you for accepting! We're looking forward to welcoming you.`,
          '',
          `Your stamped acceptance copy (proof of acceptance) is attached to this email. You can also view it online along with your company policies here: ${payload.portalLink}`,
        ].join('\n')
      : `Thank you for accepting! We're looking forward to welcoming you.`;

    const attachments = payload.acceptedPdfUrl 
      ? [{ filename: `Signed_Offer_${payload.offer.offer_number}.pdf`, url: payload.acceptedPdfUrl }]
      : undefined;

    await this.notificationService.send({
      target_email: payload.candidate.email,
      title: 'Offer Acceptance Confirmed 🎉',
      message,
      type: NotificationType.EMAIL,
      event_type: NotificationEventType.OFFER_ACCEPTED,
      metadata: payload.acceptedPdfUrl ? { accepted_pdf_url: payload.acceptedPdfUrl } : undefined,
      attachments,
    });
  }

  async sendRejectionConfirmationEmail(payload: CandidateEmailPayload): Promise<void> {
    await this.notificationService.send({
      target_email: payload.candidate.email,
      title: 'Your Response Has Been Received',
      message: `We've received your decision to decline offer ${payload.offer.offer_number}. Thank you for letting us know, and we wish you all the best.`,
      type: NotificationType.EMAIL,
      event_type: NotificationEventType.OFFER_REJECTED,
    });
  }

  async sendChangeRequestConfirmationEmail(payload: CandidateEmailPayload): Promise<void> {
    await this.notificationService.send({
      target_email: payload.candidate.email,
      title: 'Your Request Has Been Received',
      message: `We've received your requested changes for offer ${payload.offer.offer_number}. The HR team will review and get back to you shortly.`,
      type: NotificationType.EMAIL,
      event_type: NotificationEventType.OFFER_CHANGE_REQUESTED,
    });
  }

  /**
   * A NEGOTIATING offer's expiry keeps counting down while it's on HR's desk to
   * revise and resend — the candidate already responded, so the reminder that
   * matters here goes to HR, not another "please respond" nudge to the candidate.
   */
  async notifyHrNegotiationExpiringSoon(payload: HrNotificationPayload, daysBefore: number): Promise<void> {
    await this.notificationService.send({
      user_id: payload.hrUserId,
      title: 'Negotiation Expiring Soon',
      message: `The negotiation with ${this.candidateName(payload.candidate)} on offer ${payload.offer.offer_number} expires in ${daysBefore} day(s). Revise and resend the offer before it lapses.`,
      type: NotificationType.IN_APP,
      event_type: NotificationEventType.OFFER_CHANGE_REQUESTED,
    });
  }

  /** Fires when the acceptance-proof PDF fails to generate — so HR notices before a candidate asks for their copy. */
  async notifyHrAcceptanceProofFailed(payload: HrNotificationPayload): Promise<void> {
    await this.notificationService.send({
      user_id: payload.hrUserId,
      title: 'Acceptance Proof Not Generated',
      message: `${this.candidateName(payload.candidate)} accepted offer ${payload.offer.offer_number}, but the stamped acceptance copy could not be generated automatically. Please check the offer template and generate/attach a copy manually.`,
      type: NotificationType.IN_APP,
      event_type: NotificationEventType.OFFER_ACCEPTED,
    });
  }

  async notifyApprover(approverUserId: string, offerNumber: string): Promise<void> {
    await this.notificationService.send({
      user_id: approverUserId,
      title: 'Offer Pending Your Approval',
      message: `Offer ${offerNumber} is waiting for your approval.`,
      type: NotificationType.IN_APP,
      event_type: NotificationEventType.OFFER_APPROVAL_PENDING,
    });
  }

  private candidateName(candidate: OfferCandidate): string {
    return `${candidate.first_name} ${candidate.last_name}`;
  }

  private buildOfferEmailBody(payload: CandidateEmailPayload): string {
    return [
      `Dear ${payload.candidate.first_name},`,
      '',
      `Congratulations! We are pleased to extend an offer for the position of ${payload.offer.position ?? 'the role'}.`,
      '',
      `Please review your offer at: ${payload.portalLink}`,
      '',
      'Please respond before the offer expires.',
    ].join('\n');
  }
}
