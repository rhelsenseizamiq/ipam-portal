import type { Role } from './auth';

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_login: string | null;
}

export interface UserCreate {
  username: string;
  password: string;
  full_name: string;
  email?: string;
  role: Role;
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  role?: Role;
}
