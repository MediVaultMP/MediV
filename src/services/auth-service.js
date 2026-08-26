import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/app-error.js';

export class AuthService {
  constructor({ userRepository, jwtSecret, jwtExpiresIn }) {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
  }

  async register({ email, password, role }) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.userRepository.findByEmail(normalizedEmail)) {
      throw new AppError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const status = role === 'doctor' || role === 'pharmacy' ? 'pending' : 'active';
    
    // Auto-generate blockchain wallet address
    const blockchainAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
    
    const user = await this.userRepository.create({ 
      email: normalizedEmail, 
      passwordHash, 
      role, 
      status,
      blockchainAddress
    });
    return { user, token: status === 'active' ? this.createToken(user) : null };
  }

  async login({ email, password }) {
    const user = await this.userRepository.findByEmail(email.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }
    if (user.status === 'pending') {
      throw new AppError(403, 'Your account is awaiting admin approval.', 'ACCOUNT_PENDING');
    }
    if (user.status === 'rejected') {
      throw new AppError(403, 'This account has been deactivated.', 'ACCOUNT_REJECTED');
    }
    return { user: this.publicUser(user), token: this.createToken(user) };
  }

  // ✅ ADD THIS METHOD
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      throw new AppError(401, 'Invalid or expired token.', 'INVALID_TOKEN');
    }
  }

  createToken(user) {
    const payload = { 
      role: user.role, 
      email: user.email,
      sub: user.id 
    };
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  publicUser(user) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      blockchainAddress: user.blockchain_address,
      createdAt: user.created_at
    };
  }
}