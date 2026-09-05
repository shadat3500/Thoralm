import { ConfigService } from '@nestjs/config';
import { FileKind } from '@prisma/client';
import { FilesService } from './files.service';

describe('FilesService', () => {
  const service = new FilesService({
    get: (key: string, fallback?: string) => {
      if (key === 'UPLOAD_DIR') return 'uploads';
      if (key === 'APP_PUBLIC_URL') return 'http://localhost:3000';
      return fallback;
    },
  } as ConfigService);

  it('rejects missing file', async () => {
    await expect(service.save(undefined, FileKind.AVATAR)).rejects.toMatchObject({
      response: { error: 'VALIDATION_ERROR' },
    });
  });

  it('rejects pdf as avatar', async () => {
    const file = {
      mimetype: 'application/pdf',
      originalname: 'x.pdf',
      buffer: Buffer.from('x'),
    } as Express.Multer.File;

    await expect(service.save(file, FileKind.AVATAR)).rejects.toMatchObject({
      response: { error: 'VALIDATION_ERROR' },
    });
  });
});
