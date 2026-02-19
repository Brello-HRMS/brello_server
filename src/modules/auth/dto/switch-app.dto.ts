import { IsNotEmpty, IsUUID } from 'class-validator';

/** DTO for switching the active application */
export class SwitchAppDto {
    @IsUUID()
    @IsNotEmpty()
    appId: string;
}
