'use client'

import Nav from '@/components/Nav'

export default function TermsPage() {
  return (
    <div>
      <Nav />
      <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Terms of Use</h1>
      <p className="text-white/70 text-sm">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <p>
        By using Red Jitsu Training, you agree that the app is provided &quot;as is&quot;
        with no guarantees. You&apos;re responsible for how you train and use the
        information presented.
      </p>

      <h2 className="text-xl font-semibold mt-4">Not medical advice</h2>
      <p>
        The app is for training logs and general information only. It is not
        medical advice. Consult a physician or qualified coach for training,
        nutrition, and injury guidance.
      </p>

      <h2 className="text-xl font-semibold mt-4">Your responsibilities</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Keep your account secure and your email accurate.</li>
        <li>Use the app safely and within your limits.</li>
        <li>Don&apos;t abuse the service or try to access others&apos; data.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-4">Content & ownership</h2>
      <p>
        You own your training data. We host it for you. You grant us permission
        to process it to deliver the app&apos;s features.
      </p>

      <h2 className="text-xl font-semibold mt-4">Termination</h2>
      <p>
        We may suspend access in cases of abuse or security risk. You can delete
        your data in Settings, and you can request account deletion by email.
      </p>

      <h2 className="text-xl font-semibold mt-4">Contact</h2>
      <p>
        Questions? Email{' '}
        <a className="underline" href="mailto:tandersonville58@gmail.com">
          tandersonville58@gmail.com
        </a>
        .
      </p>
    </main>
    </div>
  )
}
