plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "ca.balancecdq.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "ca.balancecdq.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 2544
        versionName = "25.44"
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
    kotlinOptions {
        jvmTarget = "17"
    }
    testOptions {
        unitTests.isIncludeAndroidResources = true
        unitTests.all {
            it.testLogging.exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        }
    }
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/cdq-web-assets"))
}

val packageWebAssets by tasks.registering(Exec::class) {
    workingDir(rootProject.projectDir.parentFile)
    commandLine("node", "scripts/build-embedded-android-v2528.mjs")
}
tasks.named("preBuild").configure { dependsOn(packageWebAssets) }

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.browser:browser:1.8.0")
    implementation("com.google.android.gms:play-services-auth:21.6.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.14.1")
}
