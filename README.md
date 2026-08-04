# AC7 Taxi — Flutter app

Rider, driver and control centre. Talks to the **existing** Supabase project —
same tables, same RLS policies, same accounts as the web app. No schema change
was made for this app and none is needed.

---

## Phase 1 — what is here

| | |
|---|---|
| Project setup | pubspec, strict lints, feature-based structure |
| Supabase | connected to the live project |
| Authentication | sign in, register, password reset, session restore |
| Routing | GoRouter with role-based redirects |
| Theme | light and dark, ported from the web design tokens |

Rider, driver and admin are **named placeholders** — they show your real profile
so you can confirm auth and routing work, then say which phase builds them.

---

## Before the first run

### 1. Flutter

```bash
flutter --version     # 3.22 or newer
flutter doctor        # must be clean for the platforms you target
```

If `flutter doctor` reports missing Android licences:

```bash
flutter doctor --android-licenses
```

### 2. Create the platform folders

The `android/` and `ios/` directories are **not** committed — they are generated,
and generated platform code in git is a merge conflict waiting to happen. Create
them once, in `mobile/`:

```bash
cd mobile
flutter create . --platforms=android,ios --org uk.co.ac7group --project-name ac7_taxi
```

> `--org` sets the bundle identifier to `uk.co.ac7group.ac7_taxi`. Both stores
> treat this as permanent — it cannot be changed after the first submission
> without publishing a new listing and losing every review. Change it now if it
> is wrong.

### 3. Credentials

```bash
cp env/example.json env/dev.json
```

Fill in `env/dev.json`:

| Key | Where it comes from |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | same page — the **anon/publishable** key, never service-role |
| `GOOGLE_PLACES_KEY` | the key already in `packages/app/.env.local` |

`env/*.json` is gitignored. `env/example.json` is committed and shows the shape.

> The anon key is designed to be public — row-level security is what protects
> the data. The **service-role key must never appear in this app**: it bypasses
> RLS entirely, and anyone can unzip an APK.

### 4. Install and run

```bash
flutter pub get
flutter run --dart-define-from-file=env/dev.json
```

---

## Testing Phase 1

Sign in with an account that already exists in the web app — the two share a
database, so anything that works there works here.

| # | Do this | Expect |
|---|---|---|
| 1 | Launch the app | Brief spinner, then sign-in. **Not** a flash of sign-in before something else. |
| 2 | Sign in as a rider | Lands on **Rider**, showing your name, email, role and rider code |
| 3 | Sign in as a driver | Lands on **Driver** |
| 4 | Sign in as an admin | Lands on **Control centre** |
| 5 | Wrong password | "That email and password do not match" — never which of the two was wrong |
| 6 | Unknown email | The **same** message. Different wording would confirm which emails have accounts. |
| 7 | Kill and reopen the app | Straight back in, no sign-in screen |
| 8 | Sign out | Returns to sign-in, back button does not return to the app |
| 9 | Aeroplane mode, then sign in | "No connection", not a crash or a silent hang |
| 10 | Register a new account | Either lands in the app, or says to check your email — depending on whether the project requires confirmation |
| 11 | Register with an existing email | "An account with that email already exists" |
| 12 | Password under 8 characters | Rejected before any network call |
| 13 | Switch the phone to dark mode | The app follows, and every label stays readable |
| 14 | Rider with `onboarded_at` null | Redirected to **Finish setting up** |
| 15 | Rider deep-links to `/admin` | Bounced to the rider home |

**Report back with anything that fails.** I cannot compile Dart — there is no
toolchain in my environment — so every line here is written to be correct and is
unverified until you run it. If `flutter analyze` reports anything, paste it and
I will fix it.

---

## Known gaps

- `android/` and `ios/` are not created yet — step 2 above.
- Google Maps needs its key in `AndroidManifest.xml` and `AppDelegate.swift`;
  that comes with Phase 3 when there is a map to show.
- No tests yet. Auth is the right place to start them.

---

## Structure

```
mobile/
├── env/                     credentials, gitignored
├── lib/
│   ├── main.dart            initialise, then hand over
│   ├── app.dart             MaterialApp, theme, router
│   ├── core/
│   │   ├── config/          --dart-define values
│   │   ├── supabase/        client, session
│   │   ├── theme/           tokens + Material theme
│   │   ├── router/          GoRouter and redirects
│   │   └── widgets/         shared widgets
│   └── features/
│       ├── auth/            data / domain / presentation
│       ├── rider/           Phase 2
│       ├── driver/          Phase 2
│       └── admin/           Phase 2
└── pubspec.yaml
```

Each feature owns its own `data`, `domain` and `presentation`. A screen never
talks to Supabase directly: it reads a provider, which calls a repository, which
is the only layer that knows the database exists. That is what makes a table
rename a one-file change instead of a search across the app.
