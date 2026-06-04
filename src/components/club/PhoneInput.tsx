/**
 * PhoneInput — Premier Club gold phone field with fixed +255 prefix.
 * Caller stores 9 local digits; pass to API as `+255XXXXXXXXX`.
 */
const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

export function buildE164(local9: string) {
  const digits = local9.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9);
  return digits ? `+255${digits}` : "";
}

export default function PhoneInput({
  value,
  onChange,
  autoFocus,
  onEnter,
}: {
  value: string; // local digits only (no +255)
  onChange: (v: string) => void;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  return (
    <div
      className="flex items-stretch w-full h-12 rounded-md border overflow-hidden"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", borderColor: `${GOLD}55` }}
    >
      <div
        className="flex items-center px-3 font-faberge text-sm tracking-[0.2em]"
        style={{
          color: "#0a0a0a",
          backgroundColor: GOLD,
          borderRight: `1px solid ${GOLD_DEEP}`,
        }}
      >
        +255
      </div>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="7XX XXX XXX"
        maxLength={11}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9);
          onChange(d);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        className="flex-1 bg-transparent px-3 outline-none text-base tracking-[0.1em]"
        style={{ color: GOLD }}
      />
    </div>
  );
}
