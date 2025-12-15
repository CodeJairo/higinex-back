import { Role } from '@prisma/client';

export interface LoginUserResponse {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  customer?: object;
}
