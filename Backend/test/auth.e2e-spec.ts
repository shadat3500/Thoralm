import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { createTestApp } from './create-app';

describe('Module 1 — auth (e2e)', () => {
  let app: INestApplication;
  const email = `client.${Date.now()}@moveitz.test`;
  const password = 'Password123!';
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a client', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        fullName: 'Amina Client',
        email,
        phone: '+8801711111111',
        password,
        role: 'CLIENT',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('CLIENT');
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('rejects duplicate email', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        fullName: 'Amina Client',
        email,
        password,
        role: 'CLIENT',
      })
      .expect(409);

    expect(res.body.error).toBe('EMAIL_TAKEN');
  });

  it('logs in and returns /me', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(403);

    expect(login.body.error).toBe('ONBOARDING_INCOMPLETE');
    expect(login.body.onboardingComplete).toBe(false);
    expect(login.body.accessToken).toBeDefined();
    expect(login.body.missing).toEqual(expect.arrayContaining(['location']));

    accessToken = login.body.accessToken;
    refreshToken = login.body.refreshToken;

    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.email).toBe(email);
    expect(me.body.onboardingStep).toBe(0);
  });

  it('refreshes then rejects the old refresh token', async () => {
    const oldRefresh = refreshToken;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(401);
  });

  it('logout denylists access token', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
