// Handing the user a file.
//
// In a browser that is a download. Inside the Android app it is not: the
// WebView quietly drops downloads, so the file is written to the app's cache
// and offered through Android's share sheet, where it can be saved to Files or
// Drive or sent to someone.
import { IS_NATIVE } from './nativeShell';

export type SaveResult = 'saved' | 'shared' | 'cancelled' | 'failed';

export async function saveTextFile(name: string, text: string, mime: string): Promise<SaveResult> {
  if (!IS_NATIVE) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'saved';
  }
  try {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share')
    ]);
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, files: [uri] });
    return 'shared';
  } catch (e) {
    // Closing the share sheet without picking anything is not an error.
    return /cancel/i.test(String((e as Error)?.message ?? e)) ? 'cancelled' : 'failed';
  }
}
