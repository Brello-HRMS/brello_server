import { IsOptional, IsBooleanString } from 'class-validator';

/**
 * Query params for the reportees endpoint.
 *
 *   ?recursive=true  → return the full subtree beneath the user
 *   (default)        → return only direct reportees
 */
export class ReporteesQueryDto {
  @IsOptional()
  @IsBooleanString()
  recursive?: string;
}
