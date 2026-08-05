import java.util.Properties
import java.io.FileInputStream

/**
 * Release signing.
 *
 * ── Why this reads a file that may not exist ──────────────────────────────
 * A release APK for sideloading does not need a real keystore — Android will
 * install one signed with the debug key perfectly well. But an APK signed with
 * the debug key can NEVER be uploaded to Play, and the moment you create a
 * proper key you want the build to pick it up without editing Gradle.
 *
 * So: if android/key.properties exists, the release build is signed with your
 * key. If it does not, it falls back to debug signing and still produces an
 * installable APK. Nothing to change when you switch over.
 *
 * key.properties is gitignored. Losing the keystore after publishing means
 * losing the ability to update the app — Google cannot recover it for you.
 * Back it up somewhere that is not this laptop.
 */
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKey = keystorePropertiesFile.exists()
if (hasReleaseKey) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "uk.co.ac7group.ac7_taxi"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "uk.co.ac7group.ac7_taxi"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        /**
         * Pinned, not inherited.
         *
         * flutter.minSdkVersion follows whatever the installed Flutter ships,
         * which moves between releases. Several dependencies here set their
         * own floor - flutter_secure_storage and google_maps_flutter are the
         * highest - and when the inherited value drops below one of them the
         * build fails at manifest merge with an error naming a transitive
         * package rather than the real cause. That is a genuinely unpleasant
         * hour.
         *
         * 23 is Android 6.0, from 2015. Play's own distribution figures put
         * under 1% of active devices below it, so the cost is nil and the
         * build stops surprising you.
         */
        minSdk = 23
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = keystoreProperties["storeFile"]?.let { file(it) }
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = if (hasReleaseKey) {
                signingConfigs.getByName("release")
            } else {
                // Sideload-only. Installable, but Play will reject it.
                signingConfigs.getByName("debug")
            }

            /**
             * Shrinking is off deliberately.
             *
             * R8 strips classes it cannot see being used, and Supabase's
             * Kotlin serialisation plus the Google Maps SDK are both reached
             * reflectively. Turning it on without the matching keep rules
             * produces an APK that builds green and then crashes on the first
             * network call — which is exactly the kind of failure that wastes
             * a whole evening of testing.
             *
             * Worth enabling before the store build, with rules, and worth
             * testing on a device afterwards. Not while the point is to find
             * bugs in the app rather than in the build.
             */
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
