import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { getToken, setToken, setUnauthorizedHandler } from './api/client'
import type { User } from './api/types'
import { toast } from './toast'

interface AuthState {
  user: User | null
  signIn: (token: string, user: User) => void
  signOut: () => void
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthState | null>(null)
const USER_KEY = 'seatlock-user'

function readUser(): User | null {
  if (!getToken()) return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readUser)

  const signOut = () => {
    setToken(null)
    try {
      localStorage.removeItem(USER_KEY)
    } catch {
      /* ignore */
    }
    setUser(null)
  }

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (readUser()) toast.warning('Your session ended', 'Please sign in again to keep booking.')
      signOut()
    })
  })

  const updateUser = (next: User) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    setUser(next)
  }

  const signIn = (token: string, next: User) => {
    setToken(token)
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    setUser(next)
  }

  return <AuthContext value={{ user, signIn, signOut, updateUser }}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
