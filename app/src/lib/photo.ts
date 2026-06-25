import * as ImagePicker from 'expo-image-picker';

import { uploadsApi, type UploadResult } from './api';

/**
 * Pick a person photo and host it (TODO Stage 6; FR-10). Opens the OS image
 * library (a file dialog on web), squares + lightly compresses the pick, then
 * sends the base64 to the backend, which hosts it on Cloudinary and returns the
 * URL to store on the person. Perfect-circle avatars are a render concern - the
 * stored value is just a URL (DESIGN.md §1: never a ring around an avatar).
 */

export type PickPhotoResult =
  | { status: 'uploaded'; result: UploadResult }
  | { status: 'canceled' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

export async function pickAndUploadPhoto(): Promise<PickPhotoResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: true,
  });
  if (picked.canceled) return { status: 'canceled' };

  const asset = picked.assets[0];
  if (!asset?.base64) return { status: 'error', message: "Couldn't read that image. Try another one." };

  const mime = asset.mimeType ?? 'image/jpeg';
  const dataUri = `data:${mime};base64,${asset.base64}`;

  try {
    const result = await uploadsApi.photo(dataUri);
    return { status: 'uploaded', result };
  } catch {
    return { status: 'error', message: "Couldn't upload that photo. Check your connection and try again." };
  }
}
