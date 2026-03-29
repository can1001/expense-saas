import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Deletion Request - Chungyeon Public Service App',
  description: 'Request deletion of your personal data from Chungyeon Public Service App',
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Data Deletion Request</h1>

        <p className="mb-4">
          <strong>App Name:</strong> Chungyeon Public Service App
        </p>

        <p className="text-gray-700 mb-8">
          We respect your privacy and provide a way for users to request deletion of their personal data.
        </p>

        <h2 className="text-xl font-semibold text-gray-700 mt-8 mb-4">How to Request Data Deletion</h2>

        <div className="bg-gray-50 p-5 rounded-lg mb-6">
          <p className="font-semibold mb-2">Option 1 (In-App):</p>
          <ol className="list-decimal list-inside space-y-1 mb-4 text-gray-700">
            <li>Open the app</li>
            <li>Go to <strong>Settings → Account → Delete Account</strong></li>
            <li>Follow the instructions</li>
          </ol>

          <p className="font-semibold mb-2">Option 2 (Email Request):</p>
          <p className="text-gray-700">
            Send an email to: <strong>chungyeon.ad@gmail.com</strong><br />
            Include your account email or user ID.
          </p>
        </div>

        <h2 className="text-xl font-semibold text-gray-700 mt-8 mb-4">What Data Will Be Deleted</h2>

        <ul className="list-disc list-inside space-y-1 text-gray-700 mb-6">
          <li>Account information (email, user ID)</li>
          <li>Service usage data</li>
          <li>Any stored personal information</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-700 mt-8 mb-4">Data Retention Policy</h2>

        <p className="text-gray-700 mb-6">
          All personal data will be deleted upon request.<br />
          Some data may be retained for up to <strong>30 days</strong> for legal and security purposes, after which it will be permanently deleted.
        </p>

        <h2 className="text-xl font-semibold text-gray-700 mt-8 mb-4">Contact</h2>

        <p className="text-gray-700">
          Email: <strong>chungyeon.ad@gmail.com</strong>
        </p>
      </div>
    </div>
  );
}
