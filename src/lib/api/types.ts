import * as z from 'zod/mini'

/** Runtime-validated API contract: every response is parsed before components see it. */

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
})
export type User = z.infer<typeof UserSchema>

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
})
export type LoginResponse = z.infer<typeof LoginResponseSchema>

export const ErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
})
export type ErrorBody = z.infer<typeof ErrorBodySchema>
