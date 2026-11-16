import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Data, DEFAULT, migrate } from './logic';

const K = 'leave-data', BAK = 'leave-data-prev';

export async function load(): Promise<Data> {
  for (const key of [K, BAK]) {           // fall back to previous snapshot if main record is corrupt
    try { const { value } = await Preferences.get({ key }); if (value) return migrate(JSON.parse(value)); } catch {}
  }
  return DEFAULT;
}
export async function save(d: Data) {
  const { value } = await Preferences.get({ key: K });
  if (value) await Preferences.set({ key: BAK, value });
  await Preferences.set({ key: K, value: JSON.stringify(d) });
}
export async function exportData(d: Data) {
  const name = `leave-backup-${new Date().toISOString().slice(0, 10)}.json`, text = JSON.stringify(d, null, 2);
  if (!Capacitor.isNativePlatform()) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; a.click(); return;
  }
  const r = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: name, url: r.uri });
}
export const importData = (text: string): Data => migrate(JSON.parse(text));
