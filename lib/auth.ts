// Auth is session-based (no user accounts required).
// These stubs keep the type contract intact so existing
// components that reference AuthUser continue to compile.

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

export interface SignUpDetails {
  email: string;
  password: string;
  fullName: string;
  birthday: string;
}

export async function signUp(_details: SignUpDetails) {
  return { data: null, error: new Error("Auth not configured") };
}

export async function signIn(_email: string, _password: string) {
  return { data: null, error: new Error("Auth not configured") };
}

export async function signOut() {}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return null;
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  callback(null);
  return { unsubscribe: () => {} };
}
