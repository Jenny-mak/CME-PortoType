import { DemoUser } from "./types";

/** Demo users for login, profile, and Users admin (mock credentials). */
export const demoUsers: DemoUser[] = [
  {
    id: "100001",
    username: "Zhangwei",
    password: "password",
    displayName: "Zhangwei",
    bu: "CBA-A-A1",
    role: "RM",
    profile: "Standard",
    status: "Active",
    outlookEmail: "zhangwei@cba.outlook.com",
    mobile: "+852 9123 0001",
    manager: "Lina",
    department: "Corporate Banking",
    lastLogin: "2026-07-29 09:12",
  },
  {
    id: "100002",
    username: "Lina",
    password: "password",
    displayName: "Lina",
    bu: "CBA-A-A1",
    role: "TH",
    profile: "Standard",
    status: "Active",
    outlookEmail: "lina@cba.outlook.com",
    mobile: "+852 9123 0002",
    manager: "Roy",
    department: "Corporate Banking",
    lastLogin: "2026-07-29 14:05",
  },
  {
    id: "100003",
    username: "Roy",
    password: "password",
    displayName: "Roy",
    bu: "CBA-A",
    role: "Dept Head",
    profile: "Administrator",
    status: "Active",
    outlookEmail: "roy@cba.outlook.com",
    mobile: "+852 9123 0003",
    manager: "Lily",
    department: "Corporate Banking",
    lastLogin: "2026-07-28 18:40",
  },
  {
    id: "100004",
    username: "Lily",
    password: "password",
    displayName: "Lily",
    bu: "CBA",
    role: "DH",
    profile: "Administrator",
    status: "Active",
    outlookEmail: "lily@cba.outlook.com",
    mobile: "+852 9123 0004",
    manager: "",
    department: "Corporate Banking",
    lastLogin: "2026-07-30 08:22",
  },
  {
    id: "100005",
    username: "Huayi",
    password: "password",
    displayName: "Huayi",
    bu: "Business Admin",
    role: "STM",
    profile: "Business Admin",
    status: "Active",
    outlookEmail: "huayi@cba.outlook.com",
    mobile: "+852 9123 0005",
    manager: "Lily",
    department: "Business Administration",
    lastLogin: "2026-07-27 11:18",
  },
  {
    id: "100006",
    username: "Developer",
    password: "password",
    displayName: "Developer",
    bu: "System Admin",
    role: "Developer",
    profile: "Administrator",
    status: "Active",
    outlookEmail: "developer@cba.outlook.com",
    mobile: "+852 9123 0006",
    manager: "",
    department: "IT",
    lastLogin: "2026-07-30 07:55",
  },
];

export type PublicUser = Omit<DemoUser, "password">;

export function toPublicUser(user: DemoUser): PublicUser {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export function authenticate(username: string, password: string): PublicUser | null {
  const normalized = username.trim().toLowerCase();
  const match = demoUsers.find(
    (user) => user.username.toLowerCase() === normalized && user.password === password,
  );
  return match ? toPublicUser(match) : null;
}

export function findUserByUsername(username: string): PublicUser | null {
  const match = demoUsers.find((user) => user.username.toLowerCase() === username.trim().toLowerCase());
  return match ? toPublicUser(match) : null;
}

export const USER_STATUS_OPTIONS = ["Active", "Inactive"] as const;
export const USER_ROLE_OPTIONS = ["RM", "TH", "Dept Head", "DH", "STM", "Developer", "Admin"] as const;
export const USER_PROFILE_OPTIONS = ["Standard", "Administrator", "Read Only", "Business Admin"] as const;
export const USER_BU_OPTIONS = [
  "CBA",
  "CBA-A",
  "CBA-A-A1",
  "Business Admin",
  "System Admin",
] as const;
export const USER_DEPARTMENT_OPTIONS = [
  "Corporate Banking",
  "Business Administration",
  "IT",
  "Risk & Compliance",
  "Operations",
] as const;
