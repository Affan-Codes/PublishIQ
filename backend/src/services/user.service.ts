import userRepository from '../repositories/user.repository.js';
import { NotFoundError, ValidationError } from '../errors/custom-errors.js';
import { User, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger.js';

export const userService = {
  async getUserById(id: string): Promise<User> {
    logger.debug({ id }, 'Fetching user by ID');
    const user = await userRepository.getById(id);
    if (!user) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }
    return user;
  },

  async getUserByEmail(email: string): Promise<User> {
    logger.debug({ email }, 'Fetching user by email');
    const user = await userRepository.getByEmail(email);
    if (!user) {
      throw new NotFoundError(`User with email ${email} not found`);
    }
    return user;
  },

  async createUser(data: {
    email: string;
    password?: string;
    role: Role;
    workspaceId?: string | null;
  }): Promise<User> {
    logger.info({ email: data.email, role: data.role }, 'Creating new user');

    const existing = await userRepository.getByEmail(data.email);
    if (existing) {
      throw new ValidationError(`User with email ${data.email} already exists`);
    }

    if (!data.password) {
      throw new ValidationError('Password is required when creating a new user');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    return userRepository.create({
      email: data.email,
      passwordHash,
      role: data.role,
      workspaceId: data.workspaceId ?? null,
    });
  },

  async updateUser(
    id: string,
    data: {
      email?: string;
      password?: string;
      role?: Role;
      workspaceId?: string | null;
    }
  ): Promise<User> {
    logger.info({ id }, 'Updating user fields');
    await this.getUserById(id); // Ensure exists

    if (data.email) {
      const existing = await userRepository.getByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ValidationError(`User with email ${data.email} already exists`);
      }
    }

    const updatePayload: any = { ...data };
    if (data.password) {
      updatePayload.passwordHash = await bcrypt.hash(data.password, 10);
      delete updatePayload.password;
    }

    return userRepository.update(id, updatePayload);
  },

  async deleteUser(id: string): Promise<User> {
    logger.warn({ id }, 'Deleting user');
    const user = await this.getUserById(id); // Ensure exists
    if (user.role === Role.Owner) {
      throw new ValidationError('The system Owner account cannot be deleted');
    }
    return userRepository.delete(id);
  },

  async listUsers(workspaceId?: string): Promise<User[]> {
    logger.debug({ workspaceId }, 'Listing users');
    return userRepository.list(workspaceId);
  },
};

export default userService;
