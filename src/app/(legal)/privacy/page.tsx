import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { legal } from "@/config/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-slate-500">Effective {legal.effectiveDate}</p>
      <p>This policy explains how {legal.companyName} handles personal data in {brand.name}.</p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account data:</strong> your name, email address and password (stored only as a secure hash).</li>
        <li><strong>Billing data:</strong> handled by our payment processor (Stripe). We store your subscription status, not your card details.</li>
        <li><strong>Customer content:</strong> the contacts, conversations, flows and channel credentials you and your end users create in the Service.</li>
        <li><strong>Technical data:</strong> IP address and browser information used for security, rate limiting and troubleshooting.</li>
      </ul>

      <h2>2. Our role</h2>
      <p>For your account data we are the controller. For the data of people who message your business (your contacts), you are the controller and we process it on your behalf, only to provide the Service.</p>

      <h2>3. How we use data</h2>
      <ul>
        <li>to provide, secure and improve the Service;</li>
        <li>to send service emails such as invitations and password resets;</li>
        <li>to bill paid plans;</li>
        <li>to comply with legal obligations.</li>
      </ul>
      <p>We do not sell personal data.</p>

      <h2>4. Sharing</h2>
      <p>We share data only with providers that help us run the Service (hosting, database, email delivery, payments) and with the messaging platforms you connect, so messages can be delivered.</p>

      <h2>5. Security</h2>
      <p>Data is encrypted in transit. Channel credentials are encrypted at rest. Access is restricted to what is needed to operate the Service.</p>

      <h2>6. Retention and deletion</h2>
      <p>We keep data while your account is active. You can delete contacts, channels and conversations at any time. When a workspace is deleted, its data is removed from our systems, except where we must keep records by law.</p>

      <h2>7. Your rights</h2>
      <p>Depending on where you live, you may have the right to access, correct, export or delete your personal data, and to object to processing. Contact us to exercise them. End users who messaged a business should contact that business first.</p>

      <h2>8. Contact</h2>
      <p>{legal.companyName}, {legal.address}. Email: <a className="text-brand-700 underline" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a></p>
    </article>
  );
}
