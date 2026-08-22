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
    const user = await this.userRepository.create({ email: normalizedEmail, passwordHash, role });
    return { user, token: this.createToken(user) };
  }

  async login({ email, password }) {
    const user = await this.userRepository.findByEmail(email.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }
    return { user: this.publicUser(user), token: this.createToken(user) };
  }

  createToken(user) {
    return jwt.sign({ role: user.role, email: user.email }, this.jwtSecret, {
      subject: user.id,
      expiresIn: this.jwtExpiresIn
    });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch {
      throw new AppError(401, 'Invalid or expired access token.', 'INVALID_TOKEN');
    }
  }

  publicUser(user) {
    return { id: user.id, email: user.email, role: user.role, createdAt: user.created_at };
  }
}
