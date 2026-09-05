import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { PatchClientOnboardingDto } from './dto/patch-client-onboarding.dto';
import { PatchTrainerOnboardingDto } from './dto/patch-trainer-onboarding.dto';

@ApiTags('onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.onboarding.get(user.id);
  }

  @Patch('client')
  patchClient(
    @CurrentUser() user: AuthUser,
    @Body() dto: PatchClientOnboardingDto,
  ) {
    return this.onboarding.patchClient(user.id, user.role, dto);
  }

  @Patch('trainer')
  patchTrainer(
    @CurrentUser() user: AuthUser,
    @Body() dto: PatchTrainerOnboardingDto,
  ) {
    return this.onboarding.patchTrainer(user.id, user.role, dto);
  }

  @Post('complete')
  complete(@CurrentUser() user: AuthUser) {
    return this.onboarding.complete(user.id);
  }
}
