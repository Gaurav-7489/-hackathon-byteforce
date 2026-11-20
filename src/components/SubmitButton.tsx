import type { ReactNode, Ref } from 'react'
import { useFormStatus } from 'react-dom'

interface Props {
  children: ReactNode
  pendingLabel: string
  className?: string
  disabled?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** useFormStatus: reads the enclosing <form action>'s pending state. */
export function SubmitButton({ children, pendingLabel, className = 'lk-btn lk-btn-primary lk-btn-lg lk-btn-block', disabled, ref }: Props) {
  const { pending } = useFormStatus()
  return (
    <button ref={ref} type="submit" className={className} disabled={pending || disabled} aria-disabled={pending || disabled}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
