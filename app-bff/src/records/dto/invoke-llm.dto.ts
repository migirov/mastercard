import { IsOptional, IsString } from 'class-validator';

/** Body of `POST /integrations/invoke-llm` — the `InvokeLLM` integration. */
export class InvokeLlmDto {
  @IsOptional()
  @IsString()
  prompt?: string;
}
