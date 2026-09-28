import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing (infrastructure-specification.md, cicd-pipeline.md): the
// upload keystore and its passwords live ONLY in android/key.properties on the
// builder's machine (git-ignored). When the file is absent — CI, a fresh
// clone, a contributor without release rights — the release build type falls
// back to the debug signing config so `flutter run --release` still works.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseSigning = keystorePropertiesFile.exists()
if (hasReleaseSigning) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

android {
    namespace = "in.sarovarjinalaya.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Production application ID — also the ID the Firebase Android app and
        // the Play Console listing are registered under. Change it here BEFORE
        // registering those (code-generation-plan.md, Layout decision).
        applicationId = "in.sarovarjinalaya.app"
        // Amplify Flutter requires API 24+.
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseSigning) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
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

// Firebase (Crashlytics + FCM): the Google Services and Crashlytics Gradle
// plugins are applied only once android/app/google-services.json exists —
// i.e. after the one-time `flutterfire configure` (README "Mobile App" >
// Firebase). Until then the app builds and runs without Firebase, and
// lib/services/app_bootstrap.dart reports Firebase as unavailable at runtime.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
} else {
    logger.warn(
        "android/app/google-services.json not found — building without Firebase " +
            "(Crashlytics and push reminders disabled). Run `flutterfire configure` to add it.",
    )
}
