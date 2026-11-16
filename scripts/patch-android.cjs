// Runs in CI after `cap add android`: sets version + release signing so every build is an in-place upgrade.
const fs = require('fs'); const p = 'android/app/build.gradle'; let g = fs.readFileSync(p, 'utf8');
g = g.replace(/versionCode\s+\d+/, `versionCode ${process.env.VERSION_CODE || 1}`)
     .replace(/versionName\s+"[^"]*"/, `versionName "${process.env.VERSION_NAME || '1.0'}"`)
     .replace(/(buildTypes\s*{\s*release\s*{)/, '$1\n            signingConfig signingConfigs.release')
     .replace(/buildTypes\s*{/, `signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH"))
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEYSTORE_PASSWORD")
        }
    }
    buildTypes {`);
fs.writeFileSync(p, g);
