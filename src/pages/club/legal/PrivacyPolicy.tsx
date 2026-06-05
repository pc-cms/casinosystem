import LegalLayout, { LegalSection } from "./LegalLayout";

const intro = [
  "Joker Casino Ltd, trading as Premier Casino, respects your privacy and is committed to protecting your personal information.",
  "This Privacy Policy explains how we collect, use, store, protect and disclose information when you register for, access or use Premier Club, including customer registration, verification, loyalty membership, promotions, rewards, SMS notifications and related casino services.",
  "By registering for Premier Club or submitting your information to us, you acknowledge that you have read and understood this Privacy Policy.",
];

const sections: LegalSection[] = [
  {
    heading: "Introduction",
    paragraphs: [
      "Joker Casino Ltd, trading as Premier Casino, respects your privacy and is committed to protecting your personal information.",
      "This Privacy Policy explains how we collect, use, store, protect and disclose information when you register for, access or use Premier Club, including customer registration, verification, loyalty membership, promotions, rewards, SMS notifications and related casino services.",
    ],
  },
  {
    heading: "Who We Are",
    paragraphs: ["Premier Club is operated by:"],
    bullets: [
      "Joker Casino Ltd",
      "Trading as Premier Casino",
      "Address: Arusha, Tanzania",
      "Email: info@premiercasino.tz",
    ],
  },
  {
    heading: "Information We Collect",
    paragraphs: ["We may collect and process the following information:"],
    bullets: [
      "Identification information, including full name, date of birth, nationality, gender, ID or passport number, photo ID and other verification documents.",
      "Contact information, including phone number, email address and other contact details.",
      "Membership information, including Premier Club membership number, QR code, loyalty status, visit history, rewards, benefits, points, promotions and redemption history.",
      "Gaming and transaction information, including casino visits, gaming activity, cash desk records, promotion participation, loyalty rewards, prize claims and other records required for casino operations, compliance, audit and responsible gaming.",
      "Technical information, including device information, IP address, login activity, system logs, timestamps and security records when using digital systems connected to Premier Club.",
      "Responsible gaming information, including self-exclusion requests, restrictions, internal responsible gaming notes or other information required to protect customers and comply with gaming obligations.",
    ],
  },
  {
    heading: "How We Use Your Information",
    paragraphs: ["We use your personal information to:"],
    bullets: [
      "Register and verify Premier Club members.",
      "Confirm your identity and age eligibility.",
      "Manage loyalty membership, rewards, promotions and customer benefits.",
      "Send SMS notifications related to Premier Club, rewards, promotions, service messages or important account updates.",
      "Provide customer service and respond to your requests.",
      "Maintain security, prevent fraud, detect misuse and protect casino operations.",
      "Comply with gaming, tax, anti-money laundering, audit, regulatory and legal obligations.",
      "Support responsible gaming, including self-exclusion, customer protection and internal risk controls.",
      "Improve our services, systems, customer experience and operational reporting.",
    ],
  },
  {
    heading: "SMS Notifications and Marketing",
    paragraphs: [
      "Premier Casino may send SMS notifications to registered Premier Club members. These may include loyalty updates, rewards, promotions, service messages, account updates and responsible gaming information.",
      "You may opt out of promotional SMS messages by contacting Premier Casino at info@premiercasino.tz or by following the unsubscribe instructions provided in the message, where available.",
      "Opting out of promotional messages does not prevent Premier Casino from sending important service, security, compliance or responsible gaming communications.",
    ],
  },
  {
    heading: "Legal Basis for Processing",
    paragraphs: [
      "We process personal information where it is necessary for lawful casino operations, membership administration, regulatory compliance, fraud prevention, customer protection, responsible gaming, contractual performance, legitimate business purposes or where you have given consent.",
      "Where consent is required, you may withdraw your consent, subject to legal, regulatory, audit and operational obligations that may require us to retain certain information.",
    ],
  },
  {
    heading: "Sharing of Information",
    paragraphs: [
      "We do not sell your personal information.",
      "We may share your information only where necessary with:",
    ],
    bullets: [
      "Regulatory authorities, including gaming, tax, law enforcement or data protection authorities.",
      "Internal authorised employees and managers of Premier Casino.",
      "Service providers who support our systems, verification, SMS notifications, communication, security, IT infrastructure or customer service.",
      "Professional advisers, auditors, legal consultants or compliance advisers.",
      "Other parties where required by law, court order, regulatory request or legitimate protection of our legal rights.",
    ],
  },
  {
    heading: "Data Security",
    paragraphs: [
      "We use reasonable technical, physical and administrative safeguards to protect personal information against unauthorised access, loss, misuse, alteration, disclosure or destruction.",
      "Access to customer data is restricted to authorised personnel only and is controlled based on role and operational need.",
    ],
  },
  {
    heading: "Data Retention",
    paragraphs: [
      "We retain personal information only for as long as necessary for the purposes described in this Policy, including membership administration, gaming operations, legal compliance, regulatory reporting, audit, tax, anti-money laundering, dispute resolution and responsible gaming obligations.",
      "When information is no longer required, we will securely delete, anonymise, archive or restrict access to it, subject to applicable law.",
    ],
  },
  {
    heading: "Your Rights",
    paragraphs: ["Subject to applicable law, you may request to:"],
    bullets: [
      "Access your personal information.",
      "Correct inaccurate or incomplete information.",
      "Update your contact or membership details.",
      "Withdraw consent where processing is based on consent.",
      "Object to direct marketing.",
      "Request deletion or restriction of processing, where legally permitted.",
      "Submit a complaint to the relevant authority if you believe your rights have been violated.",
    ],
  },
  {
    heading: "Children and Underage Persons",
    paragraphs: [
      "Premier Club and casino services are strictly intended for persons legally permitted to participate in gaming activities.",
      "We do not knowingly register underage persons. If we discover that an underage person has provided personal information, we will take appropriate steps to block access and handle the information according to legal and regulatory requirements.",
    ],
  },
  {
    heading: "Updates to This Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. The latest version will be available through Premier Club or at Premier Casino premises.",
    ],
  },
  {
    heading: "Contact Us",
    paragraphs: ["For privacy questions or requests, please contact:"],
    bullets: [
      "Joker Casino Ltd trading as Premier Casino",
      "Address: Arusha, Tanzania",
      "Email: info@premiercasino.tz",
    ],
  },
];

export default function PrivacyPolicy() {
  return <LegalLayout title="Privacy Policy" intro={intro} sections={sections} />;
}
