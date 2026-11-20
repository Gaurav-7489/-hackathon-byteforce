import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  tone?: 'danger' | 'default'
}

/**
 * Destructive-action confirmation on the native <dialog>: modal focus trap,
 * Escape to close, focus returns to the trigger, labelled by its heading.
 * The safe action gets initial focus.
 */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel, onConfirm, tone = 'danger' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      cancelRef.current?.focus()
    } else if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dlg-title"
      aria-describedby="dlg-desc"
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <h2 id="dlg-title">{title}</h2>
      <p id="dlg-desc">{description}</p>
      <div className="dialog-actions">
        <button ref={cancelRef} type="button" className="lk-btn" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </button>
        <button type="button" className={`lk-btn ${tone === 'danger' ? 'lk-btn-danger' : 'lk-btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
