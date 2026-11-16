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

// App icon + splash (pre-rendered in /icons)
const res = 'android/app/src/main/res';
for (const dens of fs.readdirSync('icons').filter(x => x !== 'splash'))
  for (const f of fs.readdirSync(`icons/${dens}`)) fs.copyFileSync(`icons/${dens}/${f}`, `${res}/mipmap-${dens}/${f}`);
for (const f of fs.readdirSync('icons/splash')) fs.copyFileSync(`icons/splash/${f}/splash.png`, `${res}/${f}/splash.png`);
fs.writeFileSync(`${res}/values/ic_launcher_background.xml`,
  '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B0B10</color>\n</resources>\n');
