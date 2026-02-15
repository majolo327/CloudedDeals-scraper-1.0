'use client';

import { ArrowLeft } from 'lucide-react';

interface PrivacyPageProps {
  onBack: () => void;
}

export function PrivacyPage({ onBack }: PrivacyPageProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <div className="bg-white rounded-xl p-6 sm:p-10 overflow-x-hidden text-[#595959] font-[Arial]">
        <h1 style={{ fontSize: 26, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginBottom: 4 }}>PRIVACY POLICY</h1>
        <p style={{ fontSize: 14, color: '#595959', marginBottom: 24 }}><strong>Last updated July 07, 2025</strong></p>

        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          This Privacy Policy for <strong>Clouded Inc.</strong> (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) describes how and why we might access, collect, store, use, and/or share (&quot;process&quot;) your personal information when you use our services (&quot;Services&quot;), including when you:
        </p>
        <ul style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 16, paddingLeft: 24, listStyleType: 'square' }}>
          <li>Visit our website at <strong>useclouded.com</strong>, or any website of ours that links to this Privacy Policy</li>
          <li>Use <strong>Clouded</strong>, our mobile application</li>
          <li>Engage with us in other related ways, including any sales, marketing, or events</li>
        </ul>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>SUMMARY OF KEY POINTS</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          This summary provides key points from our Privacy Policy. We process personal information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.
        </p>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>1. WHAT INFORMATION DO WE COLLECT?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}><strong>Personal information you disclose to us.</strong></p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us. This may include: names, phone numbers, email addresses, mailing addresses, usernames, passwords, contact preferences, billing addresses, and debit/credit card numbers.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          <strong>Information automatically collected.</strong> We automatically collect certain information when you visit, use, or navigate the Services. This information does not reveal your specific identity but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Services, and other technical information. This information is primarily needed to maintain the security and operation of our Services, and for our internal analytics and reporting purposes.
        </p>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>2. HOW DO WE PROCESS YOUR INFORMATION?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          We process your personal information for a variety of reasons, depending on how you interact with our Services, including: to facilitate account creation and authentication; to deliver and facilitate delivery of services to the user; to respond to user inquiries and offer support; to send administrative information; to fulfill and manage your orders, payments, returns, and exchanges; to request feedback; to send you marketing and promotional communications (with your consent where required); to protect our Services; to identify usage trends; to determine the effectiveness of our marketing campaigns; and to comply with our legal obligations.
        </p>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          We may share information in specific situations and with specific third parties, including: business transfers (in connection with any merger, sale of company assets, financing, or acquisition of all or a portion of our business); affiliates (we may share your information with our affiliates, in which case we will require those affiliates to honor this Privacy Policy); and business partners (we may share your information with our business partners to offer you certain products, services, or promotions).
        </p>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>4. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          We may use cookies and similar tracking technologies (like web beacons and pixels) to gather information when you interact with our Services. We use cookies to store user preferences and to track user activity on our Services for analytics purposes. You can set your browser to refuse all or some browser cookies, or to alert you when cookies are being sent. If you disable or refuse cookies, some parts of the Services may become inaccessible or not function properly.
        </p>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>5. HOW LONG DO WE KEEP YOUR INFORMATION?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Policy, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible, then we will securely store your personal information and isolate it from any further processing until deletion is possible.
        </p>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>6. HOW DO WE KEEP YOUR INFORMATION SAFE?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information.
        </p>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>7. WHAT ARE YOUR PRIVACY RIGHTS?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          Depending on your state of residence in the US or in some regions (like the EEA, UK, Switzerland, and Canada), you have rights that allow you greater access to and control over your personal information. You may review, change, or terminate your account at any time. If you are a resident in the European Economic Area and you believe we are unlawfully processing your personal information, you also have the right to complain to your local data protection supervisory authority.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          <strong>Account Information:</strong> If you would at any time like to review or change the information in your account or terminate your account, you can contact us using the contact information provided. Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements.
        </p>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>8. DO WE MAKE UPDATES TO THIS POLICY?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          We may update this Privacy Policy from time to time. The updated version will be indicated by an updated &quot;Last updated&quot; date at the top of this Privacy Policy. If we make material changes to this Privacy Policy, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Policy frequently to be informed of how we are protecting your information.
        </p>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>9. HOW CAN YOU CONTACT US ABOUT THIS POLICY?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
          If you have questions or comments about this policy, you may email us at <a href="mailto:hello@cloudeddeals.com" style={{ color: '#3030F1' }}>hello@cloudeddeals.com</a> or by post to:
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          <strong>Clouded Inc.</strong><br />
          304 S. Jones Blvd<br />
          #7003<br />
          Las Vegas, NV 89107<br />
          United States
        </p>

        <h2 style={{ fontSize: 19, color: '#000', fontFamily: 'Arial', fontWeight: 'bold', marginTop: 32, marginBottom: 12 }}>10. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. To request to review, update, or delete your personal information, please email us at <a href="mailto:hello@cloudeddeals.com" style={{ color: '#3030F1' }}>hello@cloudeddeals.com</a>.
        </p>
      </div>
    </div>
  );
}
