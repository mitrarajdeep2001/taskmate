export const getBase64 = (file: File): Promise<string | ArrayBuffer | null> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

type FormDataPrimitive = string | number | boolean | Blob | File | null | undefined;

export function getFormData(
  payload: Record<string, FormDataPrimitive | FormDataPrimitive[]>
): FormData {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    // Handle arrays
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item !== null && item !== undefined) {
          formData.append(key, item as any);
        }
      });
      return;
    }

    // Handle primitives
    formData.append(key, value as any);
  });

  return formData;
}
