/**
 * PhotoUploader Component (UC-05, FR-08, BR-04, E2).
 * Form đăng tin – Tải và quản lý 1–5 ảnh sản phẩm:
 *  - Chọn ảnh từ thư viện hoặc máy ảnh (JPG/PNG).
 *  - Xem trước ảnh (preview), hiển thị ảnh bìa (#1) và thứ tự.
 *  - Xóa ảnh và giải phóng URL tạm.
 *  - Đổi thứ tự ảnh (sort_order): chuyển trái/phải hoặc đặt làm ảnh bìa.
 *  - Chặn quá 5 ảnh, sai định dạng (từ chối GIF), quá 5 MB kèm thông báo rõ (E2).
 *  - Bắt buộc có ít nhất 1 ảnh (BR-04).
 */

import React, { useRef, useState } from 'react';
import {
  Camera,
  ImagePlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Star,
  AlertCircle,
  X,
  FileImage,
} from 'lucide-react';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const createObjectURL = (file) => {
  if (typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function') {
    return window.URL.createObjectURL(file);
  }
  return `blob:mock-url-${file.name}`;
};

const revokeObjectURL = (url) => {
  if (typeof window !== 'undefined' && window.URL && typeof window.URL.revokeObjectURL === 'function') {
    try {
      window.URL.revokeObjectURL(url);
    } catch {
      // Ignore if mock
    }
  }
};

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function PhotoUploader({
  photos = [],
  onChange,
  error = null,
  maxPhotos = 5,
}) {
  const fileInputRef = useRef(null);
  const [localError, setLocalError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Validate individual file
  const validateFile = (file) => {
    // 1. Kiểm tra dung lượng
    if (file.size === 0) {
      return `Tệp "${file.name}" rỗng (0 bytes). Vui lòng chọn tệp ảnh hợp lệ.`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `Ảnh "${file.name}" dung lượng ${sizeMB} MB, vượt quá giới hạn tối đa 5 MB (E2, BR-04).`;
    }

    // 2. Kiểm tra phần mở rộng tệp
    const name = file.name || '';
    const lastDot = name.lastIndexOf('.');
    const ext = lastDot !== -1 ? name.slice(lastDot).toLowerCase() : '';

    if (ext === '.gif' || file.type === 'image/gif') {
      return `Tệp "${file.name}" là định dạng GIF không được chấp nhận. Hệ thống chỉ hỗ trợ ảnh JPG hoặc PNG (E2, BR-04).`;
    }

    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return `Định dạng tệp "${file.name}" không hợp lệ. Chỉ chấp nhận ảnh JPG hoặc PNG (E2, BR-04).`;
    }

    return null;
  };

  // Handle file selection from input or drop
  const handleFiles = (incomingFileList) => {
    setLocalError(null);
    if (!incomingFileList || incomingFileList.length === 0) return;

    const newFiles = Array.from(incomingFileList);

    // Kiểm tra tổng số lượng ảnh (chặn > 5 ảnh)
    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      setLocalError(`Bạn đã tải lên tối đa ${maxPhotos} ảnh. Vui lòng xóa bớt ảnh trước khi thêm mới (BR-04).`);
      return;
    }

    if (newFiles.length > remainingSlots) {
      setLocalError(
        `Chỉ được tải lên tối đa ${maxPhotos} ảnh (BR-04). Bạn đã có ${photos.length} ảnh và chỉ có thể thêm tối đa ${remainingSlots} ảnh nữa.`
      );
      return;
    }

    // Kiểm tra định dạng và dung lượng từng tệp
    const validPhotoObjects = [];
    for (const file of newFiles) {
      const fileError = validateFile(file);
      if (fileError) {
        setLocalError(fileError);
        return; // Dừng lại nếu có bất kỳ tệp nào không hợp lệ (E2)
      }

      validPhotoObjects.push({
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: createObjectURL(file),
        name: file.name,
        size: file.size,
      });
    }

    // Cập nhật danh sách ảnh kèm sort_order liên tục (1, 2, ..., N)
    const updatedList = [...photos, ...validPhotoObjects].map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));

    if (onChange) {
      onChange(updatedList);
    }

    // Reset input file để có thể chọn lại cùng một tệp nếu cần
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e) => {
    handleFiles(e.target.files);
  };

  // Xóa ảnh
  const handleDeletePhoto = (indexToDelete) => {
    setLocalError(null);
    const photoToRemove = photos[indexToDelete];
    if (photoToRemove?.previewUrl) {
      revokeObjectURL(photoToRemove.previewUrl);
    }

    const updatedList = photos
      .filter((_, idx) => idx !== indexToDelete)
      .map((item, index) => ({
        ...item,
        sortOrder: index + 1,
      }));

    if (onChange) {
      onChange(updatedList);
    }
  };

  // Đổi thứ tự ảnh (Move left / right)
  const handleMovePhoto = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= photos.length) return;
    setLocalError(null);

    const updatedList = [...photos];
    const [movedItem] = updatedList.splice(fromIndex, 1);
    updatedList.splice(toIndex, 0, movedItem);

    // Cập nhật lại sortOrder tuần tự
    const reordered = updatedList.map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));

    if (onChange) {
      onChange(reordered);
    }
  };

  // Đặt làm ảnh bìa (Move to index 0)
  const handleSetCover = (index) => {
    if (index === 0) return;
    handleMovePhoto(index, 0);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (photos.length < maxPhotos) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const displayError = localError || error;

  return (
    <div className="space-y-4">
      {/* Tiêu đề & Bộ đếm */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Hình ảnh sản phẩm <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mt-0.5">
            Từ 1 đến 5 ảnh JPG/PNG, mỗi ảnh ≤ 5 MB (BR-04, E2). Ảnh đầu tiên sẽ là ảnh bìa.
          </p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            photos.length === 0
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : photos.length === maxPhotos
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-600'
          }`}
          data-testid="photo-counter"
        >
          {photos.length}/{maxPhotos} ảnh
        </span>
      </div>

      {/* Thông báo lỗi (E2 / Bắt buộc có ít nhất 1 ảnh) */}
      {displayError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-in fade-in"
          data-testid="photo-error-alert"
        >
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1 font-medium">{displayError}</div>
          <button
            type="button"
            onClick={() => setLocalError(null)}
            className="text-red-400 hover:text-red-700 p-0.5"
            aria-label="Đóng thông báo lỗi"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Dropzone & Khu vực tải ảnh */}
      {photos.length < maxPhotos && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]'
              : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/70 bg-white'
          }`}
          data-testid="dropzone"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            multiple
            className="hidden"
            onChange={handleInputChange}
            data-testid="photo-file-input"
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
              <Camera size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                Nhấn để chọn ảnh từ thư viện hoặc máy ảnh
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Hoặc kéo thả ảnh vào đây (JPG, PNG tối đa 5 MB/ảnh)
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium mt-1">
              <ImagePlus size={14} /> Còn có thể chọn thêm {maxPhotos - photos.length} ảnh
            </div>
          </div>
        </div>
      )}

      {/* Cảnh báo khi chưa chọn ảnh nào */}
      {photos.length === 0 && (
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <FileImage size={16} className="text-amber-600 shrink-0" />
          <span>Bắt buộc có ít nhất 1 ảnh để người mua thấy được hiện trạng thật của món đồ (BR-04).</span>
        </div>
      )}

      {/* Grid danh sách ảnh đã chọn và xem trước */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3" data-testid="photos-grid">
            {photos.map((photo, index) => {
              const isCover = index === 0;
              return (
                <div
                  key={photo.id || index}
                  className={`group relative rounded-xl overflow-hidden border bg-white shadow-xs transition-all ${
                    isCover
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  data-testid={`photo-card-${index}`}
                >
                  {/* Thumbnail Image */}
                  <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                    <img
                      src={photo.previewUrl}
                      alt={photo.name || `Ảnh ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />

                    {/* Order / Cover Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      {isCover ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-bold shadow-sm">
                          <Star size={11} className="fill-white" /> Ảnh bìa
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-semibold backdrop-blur-xs">
                          #{index + 1}
                        </span>
                      )}
                    </div>

                    {/* Quick Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(index);
                      }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-sm"
                      aria-label={`Xóa ảnh ${index + 1}`}
                      data-testid={`delete-photo-${index}`}
                      title="Xóa ảnh"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Actions Bar (Reorder sort_order & Set Cover) */}
                  <div className="p-2 bg-white flex flex-col gap-1 border-t border-slate-100">
                    <p className="text-[11px] font-medium text-slate-700 truncate" title={photo.name}>
                      {photo.name || `Ảnh ${index + 1}`}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatFileSize(photo.size)}
                    </p>

                    <div className="flex items-center justify-between pt-1 gap-1 border-t border-slate-100/70">
                      {/* Di chuyển sang trái / lên trên */}
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMovePhoto(index, index - 1)}
                        className={`p-1 rounded-md text-xs flex items-center justify-center transition-colors ${
                          index === 0
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                        aria-label={`Di chuyển ảnh ${index + 1} sang trái`}
                        data-testid={`move-left-${index}`}
                        title="Đổi thứ tự sang trái"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      {/* Đặt làm ảnh bìa nếu chưa phải */}
                      {!isCover ? (
                        <button
                          type="button"
                          onClick={() => handleSetCover(index)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Đặt ảnh này làm ảnh bìa"
                          data-testid={`set-cover-${index}`}
                        >
                          Làm bìa
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-semibold">Ưu tiên 1</span>
                      )}

                      {/* Di chuyển sang phải / xuống dưới */}
                      <button
                        type="button"
                        disabled={index === photos.length - 1}
                        onClick={() => handleMovePhoto(index, index + 1)}
                        className={`p-1 rounded-md text-xs flex items-center justify-center transition-colors ${
                          index === photos.length - 1
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                        aria-label={`Di chuyển ảnh ${index + 1} sang phải`}
                        data-testid={`move-right-${index}`}
                        title="Đổi thứ tự sang phải"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 italic">
            * Mẹo: Dùng nút mũi tên để đổi thứ tự ảnh hoặc nhấn "Làm bìa" để đưa ảnh lên vị trí hiển thị chính (#1).
          </p>
        </div>
      )}
    </div>
  );
}
