import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset(email: string, token: string) {
    const appUrl = this.config.get('APP_PUBLIC_URL', 'http://localhost:3000');
    const url = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    this.logger.log(`Password reset email for ${email}: ${url}`);
  }
}
