"use client";

import { useActionState } from "react";
import { CodeFields } from "@/components/study/code-fields";
import { Button, ErrorMessage } from "@/components/ui";
import { saveOwnCode } from "@/lib/study/participant-actions";

export function CodeForm() {
  const [state, action, pending] = useActionState(saveOwnCode, undefined);
  return (
    <form action={action} className="space-y-4">
      <CodeFields defaults={state?.fields} />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" disabled={pending} className="w-full">
        Code speichern
      </Button>
    </form>
  );
}
