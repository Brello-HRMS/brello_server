import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateUserRoleMapDto {
    @IsUUID('4', { message: 'User ID must be a valid UUID' })
    @IsNotEmpty({ message: 'User ID is required' })
    user_id: string;

    @IsUUID('4', { message: 'Role ID must be a valid UUID' })
    @IsNotEmpty({ message: 'Role ID is required' })
    role_id: string;

    @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
    @IsNotEmpty({ message: 'Organization ID is required' })
    organization_id: string;
}
