import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileKind } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { ApiError } from '../common/api-error';

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const CERT_MIME = new Set([...IMAGE_MIME, 'application/pdf']);

const KIND_MIME: Record<FileKind, Set<string>> = {
  AVATAR: IMAGE_MIME,
  GALLERY: IMAGE_MIME,
  CHAT: IMAGE_MIME,
  CERT: CERT_MIME,
};

const EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
};

@Injectable()
export class FilesService {
  constructor(private readonly config: ConfigService) {}

  async save(file: Express.Multer.File | undefined, kind: FileKind) {
    if (!file) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'file is required.',
      );
    }

    const allowed = KIND_MIME[kind];
    if (!allowed?.has(file.mimetype)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        `Unsupported file type for ${kind}.`,
      );
    }

    const uploadDir = this.config.get('UPLOAD_DIR', 'uploads');
    const dir = join(process.cwd(), uploadDir, kind);
    await mkdir(dir, { recursive: true });

    const originalExt = extname(file.originalname).toLowerCase();
    const ext = EXT[file.mimetype] ?? (originalExt || '.bin');
    const name = `${randomBytes(16).toString('hex')}${ext}`;
    await writeFile(join(dir, name), file.buffer);

    const key = `${kind}/${name}`;
    const publicUrl = this.config.get('APP_PUBLIC_URL', 'http://localhost:3000');
    return {
      url: `${publicUrl.replace(/\/$/, '')}/uploads/${key}`,
      key,
      kind,
    };
  }
}
