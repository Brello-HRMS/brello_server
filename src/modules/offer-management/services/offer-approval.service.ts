import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferApprovalStep } from '../entities/offer-approval-step.entity';
import { OfferRepository } from '../repositories/offer.repository';
import { OfferTimelineRepository } from '../repositories/offer-timeline.repository';
import { OfferNotificationService } from './offer-notification.service';
import { OfferStatus } from '../enums/offer-status.enum';
import { OfferApprovalStatus } from '../enums/offer-approval-status.enum';
import { OfferTimelineEvent } from '../enums/offer-timeline-event.enum';
import { ApproveOfferStepDto, RejectOfferStepDto, AddApprovalStepDto } from '../dto/offer-approval.dto';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class OfferApprovalService {
  constructor(
    @InjectRepository(OfferApprovalStep)
    private readonly stepRepo: Repository<OfferApprovalStep>,
    private readonly offerRepo: OfferRepository,
    private readonly timelineRepo: OfferTimelineRepository,
    private readonly notificationService: OfferNotificationService,
  ) {}

  async getSteps(offerId: string): Promise<OfferApprovalStep[]> {
    return this.stepRepo.find({
      where: { offer_id: offerId },
      order: { step_order: 'ASC' },
    });
  }

  async getPendingForApprover(user: LoggedInUser): Promise<{ step: OfferApprovalStep, offer: any }[]> {
    const steps = await this.stepRepo.find({
      where: { approver_id: user.userId, approval_status: OfferApprovalStatus.PENDING },
      relations: ['offer', 'offer.candidate'],
      order: { created_at: 'DESC' }
    });

    // Only return steps where the offer is actually pending this specific step
    return steps
      .filter((s) => s.offer && s.offer.offer_status === OfferStatus.PENDING_APPROVAL && s.offer.current_approval_step === s.step_order)
      .map((s) => ({ step: s, offer: s.offer }));
  }

  async addStep(user: LoggedInUser, offerId: string, dto: AddApprovalStepDto): Promise<OfferApprovalStep> {
    const offer = await this.findOffer(user, offerId);
    if (offer.offer_status !== OfferStatus.DRAFT) {
      throw new ConflictException('Approval steps can only be added to draft offers');
    }

    const existingSteps = await this.getSteps(offerId);
    const stepOrder = dto.step_order ?? existingSteps.length + 1;

    const step = await this.stepRepo.save(
      this.stepRepo.create({
        offer_id: offerId,
        role_name: dto.role_name,
        approver_id: dto.approver_id,
        step_order: stepOrder,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
      } as Partial<OfferApprovalStep>),
    );

    await this.offerRepo.update(offerId, { requires_approval: true });

    return step;
  }

  async submitForApproval(user: LoggedInUser, offerId: string): Promise<void> {
    const offer = await this.findOffer(user, offerId);
    if (offer.offer_status !== OfferStatus.DRAFT) {
      throw new ConflictException('Only draft offers can be submitted for approval');
    }

    const steps = await this.getSteps(offerId);
    if (steps.length === 0) {
      throw new ConflictException('No approval steps configured for this offer');
    }

    await this.offerRepo.update(offerId, {
      offer_status: OfferStatus.PENDING_APPROVAL,
      current_approval_step: 1,
      modified_by: user.userId,
    });

    await this.timelineRepo.record({
      offer_id: offerId,
      event: OfferTimelineEvent.SUBMITTED_FOR_APPROVAL,
      label: 'Submitted for approval',
      actor_id: user.userId,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
    });

    const firstStep = steps[0];
    await this.notificationService.notifyApprover(firstStep.approver_id, offer.offer_number ?? offerId);
  }

  async approve(user: LoggedInUser, offerId: string, dto: ApproveOfferStepDto): Promise<void> {
    const { step, offer } = await this.findCurrentStep(user, offerId);

    await this.stepRepo.update(step.id, {
      approval_status: OfferApprovalStatus.APPROVED,
      comment: dto.comment ?? null,
      actioned_at: new Date(),
    });

    const allSteps = await this.getSteps(offerId);
    const nextStep = allSteps.find((s) => s.step_order === step.step_order + 1);

    if (nextStep) {
      await this.offerRepo.update(offerId, { current_approval_step: nextStep.step_order });
      await this.notificationService.notifyApprover(nextStep.approver_id, offer.offer_number ?? offerId);
    } else {
      // All steps approved
      await this.offerRepo.update(offerId, {
        offer_status: OfferStatus.APPROVED,
        current_approval_step: null,
      });
    }

    await this.timelineRepo.record({
      offer_id: offerId,
      event: OfferTimelineEvent.APPROVAL_STEP_APPROVED,
      label: `Step ${step.step_order} approved by ${step.role_name}`,
      actor_id: user.userId,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
    });
  }

  async reject(user: LoggedInUser, offerId: string, dto: RejectOfferStepDto): Promise<void> {
    const { step } = await this.findCurrentStep(user, offerId);

    await this.stepRepo.update(step.id, {
      approval_status: OfferApprovalStatus.REJECTED,
      comment: dto.comment,
      actioned_at: new Date(),
    });

    await this.offerRepo.update(offerId, {
      offer_status: OfferStatus.DRAFT,
      current_approval_step: null,
    });

    await this.timelineRepo.record({
      offer_id: offerId,
      event: OfferTimelineEvent.APPROVAL_STEP_REJECTED,
      label: `Step ${step.step_order} rejected by ${step.role_name}: ${dto.comment}`,
      actor_id: user.userId,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async findOffer(user: LoggedInUser, offerId: string) {
    const offer = await this.offerRepo.findOneByOrg(offerId, user.organizationId);
    if (!offer) throw new NotFoundException(`Offer "${offerId}" not found`);
    return offer;
  }

  private async findCurrentStep(user: LoggedInUser, offerId: string) {
    const offer = await this.findOffer(user, offerId);
    if (offer.offer_status !== OfferStatus.PENDING_APPROVAL) {
      throw new ConflictException('Offer is not pending approval');
    }

    const steps = await this.getSteps(offerId);
    const step = steps.find((s) => s.step_order === offer.current_approval_step);
    if (!step) throw new NotFoundException('Approval step not found');

    if (step.approver_id !== user.userId) {
      throw new ForbiddenException('You are not the assigned approver for this step');
    }

    return { step, offer };
  }
}
