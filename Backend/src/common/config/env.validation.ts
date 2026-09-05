import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  HOST: Joi.string().default('0.0.0.0'),
  PORT: Joi.number().default(3000),
  APP_PUBLIC_URL: Joi.string().default('http://localhost:3000'),
  CORS_ORIGINS: Joi.string().default('*'),

  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  PLATFORM_FEE_BPS: Joi.number().integer().default(1000),
  UPLOAD_DIR: Joi.string().default('uploads'),

  AWS_S3_BUCKET: Joi.string().allow('').optional(),
  AWS_REGION: Joi.string().allow('').optional(),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),

  STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').optional(),
});
