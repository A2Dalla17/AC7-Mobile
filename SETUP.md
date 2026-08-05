# Galeyr — from nothing to the app running on a phone

Everything below runs on **your** machine. I cannot install software on it or
start an emulator from here — my environment is a separate Linux container with
no Flutter and no access to your Android toolchain. What I have done is make the
project itself correct, which is the half that causes most first-run failures.

---

## What I already fixed in the project

| Problem | Why it matters |
|---|---|
| `INTERNET` was only in the debug manifest | Release APK installs, launches, and then every Supabase call fails. Debug works perfectly, so it looks like the backend is down. |
| `minSdk` inherited from Flutter | Moves between Flutter releases. When it drops below a dependency's floor the build fails at manifest merge, naming a transitive package instead of the real cause. Pinned to 23. |
| No release signing config | Now reads `android/key.properties` if present, falls back to debug signing so a build works today. |
| App label was `ac7_taxi` | Now **Galeyr** under the icon. |
| Code shrinking | Left off. R8 strips classes reached reflectively — Supabase and Maps both do — giving an APK that builds green and crashes on first use. |

---

## 1. Install Flutter on Windows

You currently have Flutter inside WSL. **Move it to Windows.** WSL cannot see a
USB phone without extra work, and the Android emulator will not run properly
from it. Every step below assumes Windows PowerShell.

1. Download the Windows SDK: <https://docs.flutter.dev/get-started/install/windows>
2. Unzip to `C:\src\flutter` — **not** Program Files, and not a path with
   spaces. Both break the toolchain in ways whose error messages do not mention
   the path.
3. Add `C:\src\flutter\bin` to **PATH**: press Start, type "environment
   variables", open it, edit `Path`, add the folder.
4. Open a **new** PowerShell and check:

```powershell
flutter --version
```

---

## 2. Android Studio and the SDK

Android Studio is how you get the SDK, the platform tools and the emulator. You
do not have to write code in it.

1. Install it: <https://developer.android.com/studio>
2. First launch → **More Actions** → **SDK Manager**
3. **SDK Platforms** tab — tick **Android 14 (API 34)**
4. **SDK Tools** tab — tick:
   - Android SDK Command-line Tools
   - Android SDK Platform-Tools
   - Android Emulator
5. Apply, and let it download.

Then accept the licences — the build refuses to run until you do:

```powershell
flutter doctor --android-licenses
```

Press `y` to each. Then:

```powershell
flutter doctor
```

Android toolchain must show a tick. Ignore anything about Xcode and Visual
Studio — those are for iOS and Windows desktop, neither of which you need.

---

## 3. Create the emulator

**Android Studio** → **More Actions** → **Virtual Device Manager** → **Create
Device**

- Device: **Pixel 7**
- System image: **API 34**, the **x86_64** build

  > Take x86_64, not arm64. On an Intel or AMD laptop an arm64 image has to be
  > emulated instruction by instruction and runs at roughly walking pace.

- Finish, then press ▶ to start it.

Confirm Flutter can see it:

```powershell
flutter devices
```

The Pixel should be listed. If it is not, the emulator has not finished booting
— wait for the home screen.

---

## 4. Run the app

```powershell
cd "C:\Users\hassa\OneDrive\Documents\A2 Projects\AC7 Mobile"
flutter pub get
flutter run --dart-define-from-file=env/dev.json
```

`--dart-define-from-file` is required. Without it the binary has no Supabase
credentials and refuses to start — deliberately, so you get a clear message
instead of a mysterious failure at sign-in.

**While it is running:**

| Key | Does |
|---|---|
| `r` | Hot reload — your edit appears in about a second |
| `R` | Hot restart — full state reset |
| `q` | Quit |

Hot reload is the reason to run this way while editing. Save the file, press
`r`, see the change.

---

## 5. Open it for editing

**VS Code** — lighter, and what you already use:

```powershell
code "C:\Users\hassa\OneDrive\Documents\A2 Projects\AC7 Mobile"
```

Install the **Flutter** extension (it pulls in Dart). Then `F5` runs with a
debugger attached.

**Android Studio** — heavier, better for the emulator and native Android files:
File → Open → that same folder. Not `android/` — the folder **above** it, or
Flutter tooling will not recognise the project.

---

## 6. Where everything lives

```
AC7 Mobile/
├── lib/                          ← ALL the app code is here
│   ├── main.dart                 starts up, then hands over
│   ├── app.dart                  theme, router, MaterialApp
│   │
│   ├── core/
│   │   ├── config/env.dart       Supabase URL, keys, London defaults
│   │   ├── supabase/             the client, the session
│   │   ├── theme/
│   │   │   ├── tokens.dart       ← COLOURS, SPACING, SIZES. Start here.
│   │   │   └── app_theme.dart    how those become Material widgets
│   │   ├── router/app_router.dart  every screen's path + who may see it
│   │   └── widgets/              shared widgets
│   │
│   └── features/
│       ├── splash/presentation/brand_splash.dart   ← the Galeyr animation
│       ├── auth/
│       │   ├── domain/app_user.dart      the user model
│       │   ├── data/auth_repository.dart every Supabase auth call
│       │   ├── data/auth_providers.dart  who is signed in
│       │   └── presentation/             ← login, register, forgot password
│       ├── rider/    Phase 2
│       ├── driver/   Phase 2
│       └── admin/    Phase 2
│
├── env/dev.json                  credentials — gitignored
├── android/                      native Android; rarely touched
├── reference/                    the old React app, as the written spec
└── pubspec.yaml                  dependencies
```

### The three files you will edit most

| Want to change | Open |
|---|---|
| A colour, a size, a corner radius | `lib/core/theme/tokens.dart` |
| The sign-in screen | `lib/features/auth/presentation/login_screen.dart` |
| The splash, or its duration | `lib/features/splash/presentation/brand_splash.dart` |

The splash hold is one constant near the top of that file:

```dart
const Duration kSplashHold = Duration(milliseconds: 200);
```

### The rule worth keeping

A screen never talks to Supabase directly. It reads a **provider**, which calls
a **repository**, which is the only layer that knows the database exists. That
is what makes a table rename a one-file change instead of a search across the
app — and it is why `features/*/data/` and `features/*/presentation/` are
separate.

---

## 7. Release APK for a real phone

```powershell
flutter build apk --release --dart-define-from-file=env/dev.json
```

Output: `build\app\outputs\flutter-apk\app-release.apk`

Install with the phone plugged in and USB debugging on:

```powershell
flutter install --release
```

Or copy the APK to the phone and tap it. Android will ask permission to install
from that source — normal for a sideload.

Signed with the debug key, which installs fine but can never be uploaded to
Play. See TESTING.md for creating a real keystore when you get there.

---

## What you will actually see

Be clear-eyed: the app is at **Phase 1**.

**Working:** the Galeyr splash, sign in, register, forgot password, session
restore, role-based routing, dark mode.

**Placeholders:** rider home, booking, fares, map, live tracking, driver
dashboard, wallet, chat, history, profile, settings.

Sign in with an account that already exists on the website — same Supabase
project, so the same accounts work.

---

## When it goes wrong

| Message | Fix |
|---|---|
| `flutter: command not found` | PATH not set, or you did not open a new terminal |
| `Android licenses not accepted` | `flutter doctor --android-licenses` |
| `No devices found` | Emulator not booted, or phone has USB debugging off |
| `Missing SUPABASE_URL` at launch | You left off `--dart-define-from-file=env/dev.json` |
| Emulator crawls | You picked an arm64 image; recreate with x86_64 |
| Gradle fails on first run | Normal — it is downloading. Leave it. |

Send me any error you hit. None of this Dart has been compiled — there is no
Dart toolchain in my environment — so `flutter analyze` may well find things,
and I will fix them.
