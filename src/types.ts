export type GlobalRole = "admin" | "user";
export type TeamRole = "manager" | "member";
export type Visibility = "public" | "private" | "personal";

export interface User {
  id: string;
  email: string;
  name: string;
  role: GlobalRole;
  createdAt: string;
}

export interface UserWithHash extends User {
  passwordHash: string;
}

export interface Team {
  id: string;
  name: string;
  visibility: Visibility;
  createdBy: string;
  createdAt: string;
}

export interface TeamWithRole extends Team {
  role: TeamRole;
}

export interface PublicTeam {
  id: string;
  name: string;
  createdAt: string;
}

export interface Membership {
  userId: string;
  teamId: string;
  role: TeamRole;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
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