"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = ComponentProps<"button"> & {
  /** Label shown while the server action is in flight. */
  pendingLabel?: string;
};

/**
 * Submit button that reflects the enclosing form's pending state.
 *
 * Server actions give no visual feedback on their own, so a slow action looks
 * like a frozen screen and invites a second click. Disabling while pending also
 * makes double submission impossible. Must be rendered inside the <form> whose
 * state it reports; server components can render it directly.
 */
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
