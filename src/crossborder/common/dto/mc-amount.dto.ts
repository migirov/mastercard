import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Mastercard monetary amount. NOTE: `amount` is a STRING, not a number (hence
 * `@IsString`, and the pipe for MC bodies runs without `transform` so as not to convert it).
 */
export class McAmountDto {
  @ApiPropertyOptional({
    example: '105.15',
    description: 'Amount as a string (not a number!).',
  })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}
