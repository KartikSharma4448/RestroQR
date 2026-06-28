import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for RestroQR - Digital QR Menu and Ordering Platform',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-white px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: June 28, 2026</p>

      <div className="mt-8 space-y-6 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900">1. Introduction</h2>
          <p className="mt-2">
            RestroQR (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the RestroQR mobile application and website. 
            This Privacy Policy explains how we collect, use, and protect your information when you use our services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">2. Information We Collect</h2>
          <p className="mt-2"><strong>For Restaurant Owners (App Users):</strong></p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Name, email address, and phone number (for account registration)</li>
            <li>Restaurant details (name, address, phone, menu items)</li>
            <li>Device token for push notifications (FCM)</li>
          </ul>
          <p className="mt-3"><strong>For Customers (Website Users):</strong></p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>No personal information is collected from customers</li>
            <li>No account creation is required to view menus or place orders</li>
            <li>Orders are associated with table identifiers, not personal identity</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">3. How We Use Information</h2>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>To provide and maintain our service</li>
            <li>To send push notifications about new orders to restaurant owners</li>
            <li>To process and display food orders between customers and restaurants</li>
            <li>To generate earnings reports and analytics for restaurant owners</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">4. Data Storage and Security</h2>
          <p className="mt-2">
            Your data is stored securely on cloud servers. We use industry-standard encryption 
            (AES-256-GCM for table tokens, bcrypt for passwords, HTTPS for all communications) 
            to protect your information. We do not sell or share your personal data with third parties.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">5. Third-Party Services</h2>
          <p className="mt-2">We use the following third-party services:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Firebase Cloud Messaging</strong> — for push notifications to restaurant owners</li>
            <li><strong>Cloudinary</strong> — for image storage (restaurant logos, food item images)</li>
            <li><strong>Neon PostgreSQL</strong> — for database hosting</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">6. Data Retention</h2>
          <p className="mt-2">
            We retain your account data as long as your account is active. Order history is retained 
            for restaurant analytics purposes. You can request deletion of your account and all 
            associated data by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">7. Your Rights</h2>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Access your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and data</li>
            <li>Opt-out of push notifications at any time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">8. Children&apos;s Privacy</h2>
          <p className="mt-2">
            Our service is not directed to children under 13. We do not knowingly collect 
            personal information from children.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">9. Changes to This Policy</h2>
          <p className="mt-2">
            We may update this Privacy Policy from time to time. We will notify users of any 
            material changes by posting the new policy on this page.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">10. Contact Us</h2>
          <p className="mt-2">
            If you have questions about this Privacy Policy, contact us at:
          </p>
          <p className="mt-1 font-medium">codeuppath@gmail.com</p>
        </section>
      </div>

      <div className="mt-12 border-t border-gray-100 pt-6 text-center">
        <p className="text-xs text-gray-400">
          Powered by <span className="font-semibold text-orange-500">RestroQR</span>
        </p>
      </div>
    </main>
  );
}
