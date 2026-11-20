import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

/** Accessible destructive-action confirmation (focus trap, Esc, labelled). */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Keep it', onConfirm, pending, children }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  pending?: boolean
  children?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog" role="alertdialog">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description asChild><p>{description}</p></Dialog.Description>
          {children}
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost">{cancelLabel}</button>
            </Dialog.Close>
            <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={pending}>
              {pending && <span className="spinner" aria-hidden="true" />}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
