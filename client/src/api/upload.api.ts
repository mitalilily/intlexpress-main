import axiosInstance from "./axiosInstance";

interface UploadedFileResponse {
  url: string;
  key: string;
  originalName: string;
  size: number;
  mime: string;
}

export const getPresignedDownloadUrls = async (
  keys: string | string[]
): Promise<string | Array<string | null>> => {
  const response = await axiosInstance.post("/uploads/presign-download-url", {
    keys,
  });

  if (Array.isArray(keys)) {
    return (response.data.urls || []) as Array<string | null>;
  } else {
    return response.data.url as string;
  }
};

export const uploadFileDirectly = async (
  file: File,
  folder?: string,
): Promise<UploadedFileResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  if (folder) {
    formData.append("folder", folder);
  }

  const response = await axiosInstance.post("/uploads/direct", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 60000,
  });

  return {
    url: response.data.publicUrl,
    key: response.data.key,
    originalName: response.data.originalName || file.name,
    size: Number(response.data.size || file.size),
    mime: response.data.mime || file.type || "application/octet-stream",
  };
};
