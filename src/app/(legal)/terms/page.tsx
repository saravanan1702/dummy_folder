import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { legal } from "@/config/legal";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-sm text-slate-500">Effective {legal.effectiveDate}</p>
      <p>These terms govern your use of {brand.name} (the &ldquo;Service&rdquo;), provided by {legal.companyName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account you agree to them.</p>

      <h2>1. Your account</h2>
      <p>You must provide accurate information and keep your password secure. You are responsible for all activity in your workspaces, including that of teammates you invite.</p>

      <h2>2. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>send spam or messages to people who have not agreed to hear from you;</li>
        <li>send unlawful, misleading, harassing or harmful content;</li>
        <li>violate the terms or policies of connected platforms, including Telegram, WhatsApp, Messenger and Instagram;</li>
        <li>attempt to break, overload or gain unauthorised access to the Service.</li>
      </ul>
      <p>You are responsible for obtaining any consent required to message your contacts and for honouring opt-out requests.</p>

      <h2>3. Third-party platforms</h2>
      <p>Messaging channels are provided by third parties. Their availability, rules and fees are outside our control, and they may suspend your access independently of us.</p>

      <h2>4. Plans, billing and cancellation</h2>
      <p>Paid plans are billed monthly in advance through our payment processor. You can upgrade, downgrade or cancel at any time from your billing settings; cancellation takes effect at the end of the current billing period. Fees are non-refundable except where required by law. We may change prices with at least 30 days&apos; notice.</p>

      <h2>5. Your data</h2>
      <p>You own the content and contact data you put into the Service. You grant us the rights needed to host and process it to provide the Service, as described in our Privacy Policy. You can export contacts at any time.</p>

      <h2>6. Availability and changes</h2>
      <p>We aim for high availability but do not guarantee the Service will be uninterrupted or error-free. We may add, change or remove features.</p>

      <h2>7. Suspension and termination</h2>
      <p>We may suspend or terminate accounts that breach these terms or put the Service or others at risk. You may stop using the Service at any time.</p>

      <h2>8. Disclaimer and limitation of liability</h2>
      <p>The Service is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law, we are not liable for indirect or consequential losses, and our total liability is limited to the amount you paid us in the 12 months before the claim.</p>

      <h2>9. Governing law</h2>
      <p>These terms are governed by the laws of {legal.governingLaw}.</p>

      <h2>10. Contact</h2>
      <p>{legal.companyName}, {legal.address}. Email: <a className="text-brand-700 underline" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a></p>
    </article>
  );
}
