/**
 * PhoneInput — Premier Club gold phone field with fixed "+" prefix.
 * Caller stores digits only (no +); pass to API as `+{digits}`.
 */
const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

export function buildE164(digits: string) {
  const clean = digits.replace(/\D/g, "");
  return clean ? `+${clean}` : "";
}

export default function PhoneInput({
  value,
  onChange,
  autoFocus,
  onEnter,
}: {
  value: string; // digits only (no +)
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
        +
      </div>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="1 234 567 890"
        maxLength={15}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "").slice(0, 15);
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
