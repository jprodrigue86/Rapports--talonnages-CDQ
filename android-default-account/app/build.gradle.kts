plugins {
    id("com.android.application")
}

android {
    namespace = "ca.groupecdq.balancecdqbridge"
    compileSdk = 35

    defaultConfig {
        applicationId = "ca.groupecdq.balancecdqbridge"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.android.gms:play-services-base:18.11.0")
}
