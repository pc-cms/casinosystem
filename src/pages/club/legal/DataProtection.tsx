import LegalLayout, { LegalSection } from "./LegalLayout";

const sections: LegalSection[] = [
  {
    heading: "Purpose",
    paragraphs: [
      "This Personal Data Protection Policy explains how Joker Casino Ltd, trading as Premier Casino, protects personal data collected through Premier Club and related casino operations.",
      "The purpose of this Policy is to ensure that personal data is handled lawfully, fairly, securely and transparently.",
    ],
  },
  {
    heading: "Scope",
    paragraphs: ["This Policy applies to personal data collected and processed through:"],
    bullets: [
      "Premier Club registration.",
      "Customer verification and KYC.",
      "Loyalty membership and rewards.",
      "Promotions and SMS notifications.",
      "Customer communication.",
      "Casino visits and gaming records.",
      "Responsible gaming and self-exclusion records.",
      "Security, fraud prevention, audit and compliance systems.",
    ],
  },
  {
    heading: "Data Protection Principles",
    paragraphs: ["Premier Casino follows these principles when handling personal data:"],
    bullets: [
      "Personal data must be collected for lawful, clear and legitimate purposes.",
      "Only necessary and relevant data should be collected.",
      "Personal data must be accurate and updated where required.",
      "Personal data must be used only for the purpose for which it was collected, unless another lawful basis applies.",
      "Personal data must be protected from unauthorised access, loss, misuse, alteration or disclosure.",
      "Personal data must not be disclosed to unauthorised persons.",
      "Personal data must be retained only for as long as necessary or legally required.",
      "Customers must be informed about how their data is used.",
    ],
  },
  {
    heading: "Types of Personal Data Processed",
    paragraphs: ["Premier Casino may process:"],
    bullets: [
      "Name, date of birth, nationality and gender.",
      "Phone number, email and address.",
      "ID, passport or other verification documents.",
      "Photo, customer profile image or membership identification.",
      "Premier Club membership number, QR code and loyalty status.",
      "Gaming visit records, promotion participation and reward history.",
      "Cash desk, prize, redemption and transaction-related records.",
      "Responsible gaming, exclusion or restriction records.",
      "SMS notification history and communication preferences.",
      "Security logs, CCTV-related incident references and system access records where applicable.",
    ],
  },
  {
    heading: "Sensitive and High-Risk Information",
    paragraphs: [
      "Some information may be sensitive or high-risk, including identity documents, responsible gaming records, financial transaction records, exclusion records or security-related records.",
      "Such information must be handled with stricter access control and used only for authorised business, legal, compliance, security or customer protection purposes.",
    ],
  },
  {
    heading: "Access Control",
    paragraphs: [
      "Access to personal data must be limited to authorised users based on job role and operational need.",
      "Employees must not access, copy, export, photograph, disclose or use customer data for personal reasons or outside authorised company duties.",
      "Access rights should be reviewed periodically and removed when no longer required.",
    ],
  },
  {
    heading: "Confidentiality",
    paragraphs: [
      "All customer information is confidential.",
      "Employees, contractors and service providers must protect customer information and must not disclose it to unauthorised persons, including friends, relatives, other customers, competitors or external parties.",
      "Customer information may only be shared internally or externally where there is a valid business, legal, regulatory, security or responsible gaming reason.",
    ],
  },
  {
    heading: "Data Sharing and Third Parties",
    paragraphs: [
      "Where Premier Casino uses third-party service providers, such providers may only process personal data under authorised instructions and for approved purposes.",
      "Third parties may include IT service providers, verification providers, SMS or communication providers, auditors, legal advisers, payment or financial service providers, security providers and regulatory reporting systems.",
      "Premier Casino does not sell customer personal data.",
    ],
  },
  {
    heading: "International Data Transfers",
    paragraphs: [
      "If personal data is stored, accessed or processed outside Tanzania, Premier Casino will take reasonable steps to ensure that such transfer is lawful, necessary and protected by appropriate safeguards.",
      "Where required, Premier Casino will follow applicable data protection procedures before transferring personal data outside Tanzania.",
    ],
  },
  {
    heading: "Data Security Measures",
    paragraphs: ["Premier Casino may use the following protection measures:"],
    bullets: [
      "Role-based access control.",
      "Passwords and user authentication.",
      "Secure system logs and activity tracking.",
      "Restricted access to customer records.",
      "Staff confidentiality obligations.",
      "Secure storage of documents and digital records.",
      "Backup and recovery controls.",
      "Incident reporting procedures.",
      "Periodic review of access and permissions.",
    ],
  },
  {
    heading: "Data Breach and Incident Handling",
    paragraphs: [
      "Any suspected loss, unauthorised access, misuse, disclosure or breach of personal data must be reported immediately to management or the appointed responsible person.",
      "Premier Casino will investigate the incident, take corrective action and notify the relevant authority or affected person where required by law.",
    ],
  },
  {
    heading: "Customer Requests",
    paragraphs: [
      "Customers may request access, correction, update or restriction of their personal data, subject to legal and regulatory limitations.",
      "Requests should be submitted to:",
    ],
    bullets: [
      "Joker Casino Ltd trading as Premier Casino",
      "Address: Arusha, Tanzania",
      "Email: info@premiercasino.tz",
    ],
  },
  {
    heading: "Employee Responsibilities",
    paragraphs: ["All employees and authorised users must:"],
    bullets: [
      "Use personal data only for approved work purposes.",
      "Keep customer information confidential.",
      "Report suspicious access or data incidents.",
      "Follow company procedures for registration, verification, loyalty, promotions, SMS notifications and responsible gaming.",
      "Avoid unnecessary printing, downloading, exporting or sharing of customer data.",
      "Comply with management instructions and applicable laws.",
    ],
  },
  {
    heading: "Data Retention and Disposal",
    paragraphs: [
      "Personal data must be retained according to business, legal, tax, gaming, AML, audit and responsible gaming requirements.",
      "When data is no longer required, it must be securely deleted, destroyed, anonymised or archived with restricted access.",
    ],
  },
  {
    heading: "Policy Review",
    paragraphs: [
      "This Policy may be reviewed and updated from time to time to reflect legal, operational, technical or regulatory changes.",
    ],
  },
];

export default function DataProtection() {
  return <LegalLayout title="Personal Data Protection Policy" sections={sections} />;
}
