import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { createTestApp } from './create-app';

describe('Module 2 — onboarding (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createTestApp();

    const email = `onb.${Date.now()}@moveitz.test`;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        fullName: 'Onboard Client',
        email,
        password: 'Password123!',
        role: 'CLIENT',
      })
      .expect(201);
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects trainer onboarding for a client', async () => {
    const res = await request(app.getHttpServer())
      .patch('/v1/onboarding/trainer')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ step: 1, gender: 'MALE' })
      .expect(403);
    expect(res.body.error).toBe('FORBIDDEN_ROLE');
  });

  it('rejects complete while incomplete', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/onboarding/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
    expect(res.body.error).toBe('ONBOARDING_INCOMPLETE');

    const status = await request(app.getHttpServer())
      .get('/v1/onboarding')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(status.body.onboardingComplete).toBe(false);
    expect(status.body.missing).toEqual(
      expect.arrayContaining(['gender', 'location']),
    );
  });

  it('saves client onboarding and completes', async () => {
    await request(app.getHttpServer())
      .patch('/v1/onboarding/client')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        step: 14,
        gender: 'MALE',
        age: 22,
        weightKg: 80.5,
        heightCm: 165,
        goals: ['LOSE_WEIGHT'],
        experienceLevel: 'BEGINNER',
        trainLocations: ['GYM'],
        frequency: 'TIMES_3_4_WEEK',
        coachStyle: 'MOTIVATING_ENERGETIC',
        specialNeeds: [],
        preferredLanguage: 'EN',
        trainerGenderPref: 'NO_PREFERENCE',
        lat: 23.8103,
        lng: 90.4125,
        addressText: 'Dhaka',
      })
      .expect(200);

    const done = await request(app.getHttpServer())
      .post('/v1/onboarding/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(done.body.onboardingCompletedAt).toBeTruthy();
    expect(done.body.onboardingComplete).toBe(true);
    expect(done.body.missing).toEqual([]);
    expect(done.body.clientProfile.lat).toBeCloseTo(23.8103, 4);
    expect(done.body.clientProfile.lng).toBeCloseTo(90.4125, 4);
    expect(done.body.clientProfile.addressText).toBe('Dhaka');
  });
});
