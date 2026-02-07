import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class CreateEnterpriseDto {
    @IsString()
    @IsNotEmpty({ message: 'Enterprise name is required' })
    @Length(2, 255, {
        message: 'Enterprise name must be between 2 and 255 characters',
    })
    name: string;

    @IsString()
    @IsNotEmpty({ message: 'Domain is required' })
    // @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/, {
    //     message: 'Domain must be a valid domain format (e.g., example.com)',
    // })
    domain: string;
}
