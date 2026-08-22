import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth-service.js';

class MemoryUsers {
  constructor() { this.users = []; }
  async findByEmail(email) { return this.users.find((user) => user.email === email) ?? null; }
  async create({ email, passwordHash, role }) {
    const user = { id: String(this.users.length + 1), email, password_hash: passwordHash, role, created_at: new Date().toISOString() };
    this.users.push(user);
    return { id: user.id, email: user.email, role: user.role, created_at: user.created_at };
  }
}

function api() {
  const authService = new AuthService({ userRepository: new MemoryUsers(), jwtSecret: 'test-secret-that-is-at-least-thirty-two-characters', jwtExpiresIn: '1h' });
  return createApp({ authService });
}

describe('authentication API', () => {
  it('registers, authenticates, and exposes the JWT user', async () => {
    const app = api();
    const registration = await request(app).post('/api/v1/auth/register').send({ email: 'PATIENT@example.com', password: 'correct-horse-battery', role: 'patient' }).expect(201);
    expect(registration.body.user.email).toBe('patient@example.com');
    expect(registration.body.user).not.toHaveProperty('password_hash');
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'patient@example.com', password: 'correct-horse-battery' }).expect(200);
    const me = await request(app).get('/api/v1/health/me').set('Authorization', `Bearer ${login.body.token}`).expect(200);
    expect(me.body.user).toMatchObject({ sub: '1', role: 'patient' });
  });

  it('rejects duplicate registrations and role violations', async () => {
    const app = api();
    const input = { email: 'doctor@example.com', password: 'correct-horse-battery', role: 'doctor' };
    await request(app).post('/api/v1/auth/register').send(input).expect(201);
    await request(app).post('/api/v1/auth/register').send(input).expect(409);
    const patient = await request(app).post('/api/v1/auth/register').send({ ...input, email: 'patient@example.com', role: 'patient' }).expect(201);
    await request(app).get('/api/v1/health/doctor-only').set('Authorization', `Bearer ${patient.body.token}`).expect(403);
  });
});
