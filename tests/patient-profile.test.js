import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth-service.js';
import { PatientProfileService } from '../src/services/patient-profile-service.js';

class MemoryUsers {
  constructor() { this.users = []; }
  async findByEmail(email) { return this.users.find((user) => user.email === email) ?? null; }
  async create({ email, passwordHash, role }) {
    const user = { id: String(this.users.length + 1), email, password_hash: passwordHash, role, created_at: new Date().toISOString() };
    this.users.push(user);
    return { id: user.id, email: user.email, role: user.role, created_at: user.created_at };
  }
}

class MemoryProfiles {
  constructor() { this.profiles = new Map(); }
  async findByPatientId(id) { return this.profiles.get(id) ?? null; }
  async create(id, profile) {
    const record = { patient_user_id: id, ...toDatabaseFields(profile), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.profiles.set(id, record);
    return record;
  }
  async update(id, profile) {
    const existing = this.profiles.get(id);
    if (!existing) return null;
    const record = { ...existing, ...toDatabaseFields(profile), updated_at: new Date().toISOString() };
    this.profiles.set(id, record);
    return record;
  }
}

function toDatabaseFields(profile) {
  return Object.fromEntries(Object.entries({
    first_name: profile.firstName, last_name: profile.lastName, date_of_birth: profile.dateOfBirth,
    phone: profile.phone, address: profile.address, blood_type: profile.bloodType, allergies: profile.allergies,
    emergency_contact_name: profile.emergencyContactName, emergency_contact_phone: profile.emergencyContactPhone,
    emergency_contact_relationship: profile.emergencyContactRelationship
  }).filter(([, value]) => value !== undefined));
}

function api() {
  const authService = new AuthService({ userRepository: new MemoryUsers(), jwtSecret: 'test-secret-that-is-at-least-thirty-two-characters', jwtExpiresIn: '1h' });
  const patientProfileService = new PatientProfileService({ patientProfileRepository: new MemoryProfiles() });
  return createApp({ authService, patientProfileService });
}

async function register(app, role, email) {
  return request(app).post('/api/v1/auth/register').send({ email, password: 'correct-horse-battery', role }).expect(201);
}

describe('patient profile API', () => {
  it('allows a patient to create, read, and update only their own profile', async () => {
    const app = api();
    const user = await register(app, 'patient', 'patient@example.com');
    const token = user.body.token;
    const created = await request(app).post('/api/v1/patients/me/profile').set('Authorization', `Bearer ${token}`).send({
      firstName: 'Asha', lastName: 'Patel', dateOfBirth: '1990-05-01', phone: '+919999999999',
      bloodType: 'O+', emergencyContactName: 'Ravi Patel', emergencyContactPhone: '+918888888888', emergencyContactRelationship: 'Spouse'
    }).expect(201);
    expect(created.body.profile).toMatchObject({ patientUserId: '1', firstName: 'Asha', emergencyContact: { name: 'Ravi Patel' } });
    const updated = await request(app).patch('/api/v1/patients/me/profile').set('Authorization', `Bearer ${token}`).send({ address: 'Pune', allergies: 'Penicillin' }).expect(200);
    expect(updated.body.profile).toMatchObject({ address: 'Pune', allergies: 'Penicillin', firstName: 'Asha' });
    await request(app).get('/api/v1/patients/me/profile').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('rejects profile access by a non-patient and invalid profile data', async () => {
    const app = api();
    const doctor = await register(app, 'doctor', 'doctor@example.com');
    await request(app).get('/api/v1/patients/me/profile').set('Authorization', `Bearer ${doctor.body.token}`).expect(403);
    const patient = await register(app, 'patient', 'patient@example.com');
    await request(app).post('/api/v1/patients/me/profile').set('Authorization', `Bearer ${patient.body.token}`).send({ firstName: 'Asha', lastName: 'Patel', dateOfBirth: '2026-02-31' }).expect(400);
  });
});
