export type Role = "owner" | "admin" | "member";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UserWithHash extends User {
  passwordHash: string;
}

export interface Team {
  id: string;
  name: string;
  joinCode: string;
  createdAt: string;
}

export interface TeamWithRole extends Team {
  role: Role;
}

export interface Membership {
  userId: string;
  teamId: string;
  role: Role;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export interface Note {
  id: string;
  teamId: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// Lets handlers read req.user / req.membership with proper types.
declare global {
  namespace Express {
    interface Request {
      user?: User;
      membership?: Membership;
    }
  }
}
