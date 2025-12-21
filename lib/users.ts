export const USERS = [
  { id: '1', username: '청연정혜종' },
  { id: '2', username: '청연김흥래' },
  { id: '3', username: '청연신창국' },
  { id: '4', username: '청연윤운문' },
  { id: '5', username: '청연송원영' },
] as const;

export type User = (typeof USERS)[number];

export function findUserById(id: string): User | undefined {
  return USERS.find((u) => u.id === id);
}

export function findUserByUsername(username: string): User | undefined {
  return USERS.find((u) => u.username === username);
}
