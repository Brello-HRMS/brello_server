import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuleAssignmentRepository } from '../repositories/rule-assignment.repository';
import { AttendanceRule } from '../entities/attendance-rule.entity';
import { GeoFence } from '../entities/geo-fence.entity';
import { ValidateGeoDto } from '../dto/validate-geo.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class GeoValidationService {
  private readonly logger = new Logger(GeoValidationService.name);

  /** Earth's mean radius in meters */
  private readonly EARTH_RADIUS_METERS = 6_371_000;

  constructor(
    private readonly assignmentRepo: RuleAssignmentRepository,
    @InjectRepository(AttendanceRule)
    private readonly ruleRepository: Repository<AttendanceRule>,
    @InjectRepository(GeoFence)
    private readonly geoFenceRepository: Repository<GeoFence>,
  ) {}

  async validate(
    user: LoggedInUser,
    dto: ValidateGeoDto,
  ): Promise<{ is_within_radius: boolean; distance: number }> {
    // Find effective rule for the employee
    // Note: departmentId lookup would require UserService.
    // For now, we check employee-level first, then fall back to department.
    const assignment = await this.assignmentRepo.findEffectiveRuleForEmployee(
      user.organizationId,
      dto.employee_id,
    );

    if (!assignment) {
      throw new NotFoundException('No attendance rule assigned to this employee');
    }

    const rule = await this.ruleRepository.findOne({
      where: { id: assignment.rule_id, is_deleted: false },
    });

    if (!rule) {
      throw new NotFoundException('Assigned attendance rule not found');
    }

    if (!rule.require_geo_fencing) {
      throw new UnprocessableEntityException('Geo-fencing is not enabled for this rule');
    }

    const geoFence = await this.geoFenceRepository.findOne({
      where: { rule_id: rule.id, is_deleted: false },
    });

    if (!geoFence) {
      throw new NotFoundException('Geo-fence configuration not found for this rule');
    }

    const distance = this.calculateHaversineDistance(
      dto.latitude,
      dto.longitude,
      Number(geoFence.latitude),
      Number(geoFence.longitude),
    );

    const isWithinRadius = distance <= geoFence.radius_meters;

    this.logger.debug(
      `Geo validation for employee ${dto.employee_id}: distance=${Math.round(distance)}m, radius=${geoFence.radius_meters}m, within=${isWithinRadius}`,
    );

    return {
      is_within_radius: isWithinRadius,
      distance: Math.round(distance),
    };
  }

  /**
   * Calculates the great-circle distance between two GPS coordinates
   * using the Haversine formula.
   *
   * @returns distance in meters
   */
  private calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.EARTH_RADIUS_METERS * c;
  }
}
