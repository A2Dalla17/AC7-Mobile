# Galeyr — release APK on your own phone

Sideloading only. Nothing here involves Google Play or a developer account.

---

## What you can actually test right now

Be clear-eyed about this before you install it — the app is at Phase 1.

**Built and worth testing**

| | |
|---|---|
| Brand splash | Wings, monogram, wordmark, AC7 strapline |
| Sign in | Against your real Supabase accounts |
| Register | Creates a real rider |
| Forgot password | Sends a real reset email |
| Session restore | Kill the app, reopen, still signed in |
| Role routing | Rider, driver and admin each land somewhere different |
| Dark mode | Follows the phone |

**Not built yet — placeholders**

Rider home, map, booking, fares, live tracking, driver dashboard, wallet, chat,
ride history, profile, settings, notifications. Those are Phases 2 to 4.

So this is a real APK of a real app that does authentication. It is not yet the
product. Testing "every feature as if published" is not possible until the rest
exists.

---

## Build it

```bash
cd "AC7 Mobile"
./build-apk.sh
```

Or by hand:

```bash
flutter pub get
flutter build apk --release --dart-define-from-file=env/dev.json
```

The `--dart-define-from-file` is not optional. Without it the binary has no
Supabase credentials and refuses to start — deliberately, so you get a clear
message rather than a mysterious failure at sign-in.

Output: `build/app/outputs/flutter-apk/app-release.apk`

---

## Get it onto the phone

**Over USB** — easiest:

```bash
flutter install --release
```

**Or with adb:**

```bash
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

**Or just copy the file** to the phone and tap it. Android will ask you to
allow installing from that app — that is normal for a sideload and does not
mean anything is wrong.

> **Building from WSL?** `adb` cannot see a USB phone from WSL without extra
> setup. Copy the APK to your Windows filesystem and install from there, or move
> Flutter to Windows — which you will want before Phase 3 anyway, since maps and
> GPS need a real device.

---

## What to check

| # | Do this | Expect |
|---|---|---|
| 1 | Tap the icon | Galeyr splash: wings sweep out, GR settles, wordmark rises, AC7 strapline last |
| 2 | Wait | Lands on sign-in, no flash of the wrong screen |
| 3 | Sign in as a rider | Rider placeholder, showing your real name, email and rider code |
| 4 | Sign in as a driver | Driver placeholder |
| 5 | Sign in as an admin | Control centre placeholder |
| 6 | Wrong password | "That email and password do not match" |
| 7 | Unknown email | The **same** message — different wording would confirm which emails have accounts |
| 8 | Kill the app, reopen | Splash, then straight back in. **No sign-in screen.** |
| 9 | Sign out | Back to sign-in; back button does not return to the app |
| 10 | Aeroplane mode, sign in | "No connection" — not a crash, not a silent hang |
| 11 | Register a new email | Lands in, or says check your email |
| 12 | Register an existing email | "An account with that email already exists" |
| 13 | Password under 8 characters | Rejected before any network call |
| 14 | Switch the phone to dark mode | App follows; every label stays readable |
| 15 | Rotate the phone | Stays portrait — deliberate |

**Test 10 matters most.** It is the one that proves the `INTERNET` permission
made it into the release manifest. Flutter puts that permission in the debug
manifest only, so a release build silently loses all network access — the app
launches fine and then nothing works. It is fixed here, and test 10 is how you
confirm it.

---

## Signing

Right now the APK is signed with the debug key. That installs fine and is
correct for testing.

**It cannot be uploaded to Play.** When you are ready:

```bash
keytool -genkey -v -keystore ~/galeyr-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias galeyr
```

Then create `android/key.properties`:

```
storePassword=…
keyPassword=…
keyAlias=galeyr
storeFile=/absolute/path/to/galeyr-upload.jks
```

The build picks it up automatically — no Gradle edit needed. `key.properties`
and `*.jks` are gitignored.

> **Back the keystore up somewhere that is not this laptop.** Lose it after
> publishing and you lose the ability to ever update the app. Google cannot
> recover it.

---

## Known gaps

- **Bundle ID is still `uk.co.ac7group.ac7_taxi`.** If you want
  `uk.co.ac7group.galeyr`, change it before the first Play upload — it is
  permanent afterwards.
- **App icon is still Flutter's default.** The Galeyr mark is in
  `assets/brand/galeyr-icon.svg` but has not been generated into the Android
  mipmaps yet.
- **Code shrinking is off.** R8 strips classes reached reflectively, which
  Supabase and the Maps SDK both do. Enable it with keep rules before the store
  build, and retest on a device.
