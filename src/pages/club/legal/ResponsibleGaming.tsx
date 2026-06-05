import LegalLayout, { LegalSection } from "./LegalLayout";

const sections: LegalSection[] = [
  {
    heading: "Our Commitment",
    paragraphs: [
      "Joker Casino Ltd, trading as Premier Casino, is committed to providing a safe, fair and responsible gaming environment.",
      "Gaming should be a form of entertainment. It should not be used as a way to make money, recover losses, escape personal problems or create financial pressure.",
      "Premier Casino supports responsible gaming practices and customer protection through awareness, age control, staff attention, self-exclusion and responsible handling of customer concerns.",
    ],
  },
  {
    heading: "Age Restriction",
    paragraphs: [
      "Casino gaming and Premier Club membership are available only to persons who are legally permitted to participate in gaming activities in Tanzania.",
      "Premier Casino may request identification documents to verify age and identity.",
      "Underage persons are not allowed to register, enter restricted gaming areas, participate in promotions or use Premier Club benefits.",
    ],
  },
  {
    heading: "Customer Responsibility",
    paragraphs: ["Customers are encouraged to:"],
    bullets: [
      "Play only for entertainment.",
      "Set a personal budget before gaming.",
      "Never gamble with money needed for rent, food, family, business, school fees, loans or essential expenses.",
      "Never chase losses.",
      "Take breaks during gaming.",
      "Avoid gaming when upset, intoxicated, stressed or under pressure.",
      "Ask for help if gaming no longer feels controlled.",
    ],
  },
  {
    heading: "Signs of Problem Gambling",
    paragraphs: ["Gaming may be becoming harmful if a customer:"],
    bullets: [
      "Spends more money or time than planned.",
      "Borrows money to gamble.",
      "Tries to win back losses.",
      "Hides gambling from family or friends.",
      "Feels anxious, angry or depressed because of gambling.",
      "Neglects work, family or responsibilities.",
      "Cannot stop or reduce gambling despite wanting to.",
      "Uses gambling to escape stress, debt or personal problems.",
    ],
  },
  {
    heading: "Self-Exclusion",
    paragraphs: [
      "A customer may voluntarily request to be excluded from Premier Casino gaming activities if they believe they have a gambling problem or want to stop gaming.",
      "Self-exclusion may include restriction from:",
    ],
    bullets: [
      "Premier Club membership benefits.",
      "Casino gaming areas.",
      "Promotions and SMS notifications.",
      "Reward redemption where applicable.",
    ],
  },
  {
    heading: "Cooling-Off and Account Restrictions",
    paragraphs: [
      "Premier Casino may provide temporary restriction or cooling-off options where operationally available.",
      "A customer may request temporary suspension of Premier Club promotional participation or SMS notifications.",
      "Premier Casino may also restrict or suspend a customer's participation where there are responsible gaming, security, legal, compliance or customer protection concerns.",
    ],
  },
  {
    heading: "Marketing, Promotions and SMS Notifications",
    paragraphs: [
      "Premier Casino aims to conduct promotions responsibly.",
      "We will not knowingly target underage persons or self-excluded customers.",
      "Promotions should not be interpreted as a guarantee of winning.",
      "Customers may opt out of promotional SMS notifications by contacting info@premiercasino.tz.",
    ],
  },
  {
    heading: "No Guarantee of Winning",
    paragraphs: [
      "Gaming outcomes are uncertain.",
      "Participation in casino games, promotions or Premier Club activities does not guarantee profit, reward, prize or recovery of previous losses.",
      "Customers should understand the rules and risks before participating.",
    ],
  },
  {
    heading: "Staff Training and Intervention",
    paragraphs: [
      "Premier Casino may train relevant staff to identify potential signs of harmful gaming behaviour and to respond appropriately.",
      "Where necessary, staff may provide responsible gaming information, suggest a break, escalate concerns to management or apply restrictions in line with company procedures and applicable law.",
    ],
  },
  {
    heading: "Intoxication and Vulnerable Customers",
    paragraphs: [
      "Premier Casino may refuse or restrict gaming participation where a customer appears intoxicated, aggressive, distressed, vulnerable or unable to make informed decisions.",
      "The company reserves the right to take reasonable action to protect customers, staff, other guests and the integrity of gaming operations.",
    ],
  },
  {
    heading: "Customer Support",
    paragraphs: [
      "Customers who feel they may have a gambling problem are encouraged to seek help from trusted family members, professional counsellors, medical professionals or responsible gaming support organisations.",
      "Premier Casino can provide internal guidance on self-exclusion and available support options.",
    ],
  },
  {
    heading: "Complaints and Concerns",
    paragraphs: ["Customers may raise responsible gaming concerns through:"],
    bullets: [
      "Joker Casino Ltd trading as Premier Casino",
      "Address: Arusha, Tanzania",
      "Email: info@premiercasino.tz",
      "At premises: Manager on Duty.",
    ],
  },
  {
    heading: "Policy Updates",
    paragraphs: [
      "Premier Casino may update this Responsible Gaming Policy from time to time to reflect operational, legal or regulatory changes.",
    ],
  },
];

export default function ResponsibleGaming() {
  return <LegalLayout title="Responsible Gaming Policy" sections={sections} />;
}
