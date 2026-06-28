'use client'


export default function PrivacyPage() {
  return (
    <div>
      <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-zinc-300 text-sm">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <p>
        Red Jitsu Training (&quot;we&quot;) stores the minimum data needed to run the app:
        your account email and your training logs (workouts, sets, and Jiu Jitsu
        session notes). We do not sell your data.
      </p>

      <h2 className="text-xl font-semibold mt-4">What we collect</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Account email (for login and password resets).</li>
        <li>Workout data: exercises, sets, reps, weight, and notes.</li>
        <li>Jiu Jitsu session data: type, duration, intensity, and notes.</li>
        <li>Basic device analytics (anonymous) to improve reliability.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-4">How we use it</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Authenticate you and keep your data separated from others.</li>
        <li>Show history, trends, and your programs.</li>
        <li>Send account emails (confirmations, password resets).</li>
      </ul>

      <h2 className="text-xl font-semibold mt-4">Data control</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>You can edit or delete your logs at any time.</li>
        <li>
          You can delete your data in <strong>Settings → Danger zone</strong>.
        </li>
        <li>
          To delete your account (login identity), contact us at{' '}
          <a className="underline" href="mailto:tandersonville58@gmail.com">
            tandersonville58@gmail.com
          </a>.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-4">Third-party services</h2>
      <p>We use Vercel (hosting) and Supabase (database & authentication).</p>

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
