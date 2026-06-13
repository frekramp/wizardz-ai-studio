/**
 * Simple cursor — a glowing ember dot with a soft pulsing halo that follows the
 * pointer (via the shared --mx/--my vars from CursorSpotlight) and casts the
 * art-wall torch. Desktop / fine-pointer only.
 */
export function WizardCursor() {
  return (
    <div className="wiz-cursor" aria-hidden="true">
      <div className="wiz-glow2" />
      <div className="wiz-dot" />
    </div>
  );
}
