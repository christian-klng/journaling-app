import { Button } from "@/components/ui";

/** Pfeile zum Umsortieren. Ohne Nachbarn in einer Richtung ist der Pfeil gesperrt. */
export function MoveButtons({
  up,
  down,
  label,
}: {
  up: (() => Promise<void>) | null;
  down: (() => Promise<void>) | null;
  label: string;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <form action={up ?? undefined}>
        <Button type="submit" variant="ghost" size="sm" disabled={!up} aria-label={`${label} nach oben`}>
          ↑
        </Button>
      </form>
      <form action={down ?? undefined}>
        <Button type="submit" variant="ghost" size="sm" disabled={!down} aria-label={`${label} nach unten`}>
          ↓
        </Button>
      </form>
    </div>
  );
}
