plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.aevren.xy"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.aevren.xy"
        minSdk = 26
        targetSdk = 35

        val ciRun = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull()
        versionCode = ciRun ?: 1
        versionName = if (ciRun != null) "0.1.$ciRun" else "0.1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
