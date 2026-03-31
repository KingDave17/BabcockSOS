// utils/cloudinary.ts

// Replace these with your actual Cloudinary details
const CLOUD_NAME = 'didixws6x'; 
const UPLOAD_PRESET = 'babcock_emergency'; 

/**
 * Uploads a local file (image or audio) directly to Cloudinary
 * @param localUri The local file path (e.g., from expo-image-picker or expo-av)
 * @param fileType The type of file ('image' or 'audio')
 * @returns The public Cloudinary URL of the uploaded file
 */
export const uploadMediaToCloudinary = async (localUri: string, fileType: 'image' | 'audio'): Promise<string> => {
  try {
    // Cloudinary's auto-upload endpoint handles both images and audio (which it treats as video)
    const apiUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

    // React Native requires a specific format to upload files via FormData
    const file = {
      uri: localUri,
      type: fileType === 'image' ? 'image/jpeg' : 'audio/m4a',
      name: fileType === 'image' ? `evidence_${Date.now()}.jpg` : `panic_audio_${Date.now()}.m4a`,
    } as any; // Cast as any because React Native FormData type definitions can be strict

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data',
      },
    });

    const data = await response.json();

    if (data.secure_url) {
      return data.secure_url; // This is the beautiful https://... link you save to Firebase!
    } else {
      throw new Error(data.error?.message || 'Failed to upload to Cloudinary');
    }
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw error;
  }
};