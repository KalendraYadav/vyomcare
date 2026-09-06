import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email address is required' })
  email: string;
}
