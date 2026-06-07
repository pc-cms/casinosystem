interface SectionLabelProps {
  code: string;
  label: string;
}

export function SectionLabel({ code, label }: SectionLabelProps) {
  return (
    <span className="l-eyebrow">
      <span className="l-section-code">§ {code}</span>
      <span>{label}</span>
    </span>
  );
}
