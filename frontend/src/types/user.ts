import type { Role } from './auth';

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  registration_note?: string | null;
  rejection_reason?: string | null;
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

export interface RegisterRequest {
  username: string;
  password: string;
  full_name: string;
  email?: string;
  note?: string;
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  role?: Role;
}
