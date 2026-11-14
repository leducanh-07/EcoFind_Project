/**
 * Tests for PhotoUploader Component (TE9C744, UC-05, FR-08, BR-04, E2).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PhotoUploader, { formatFileSize } from '../components/PhotoUploader';

describe('PhotoUploader Component (TE9C744, BR-04, E2)', () => {
  const createMockFile = (name, size, type) => {
    const file = new File(['mock content'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  test('Hiển thị giao diện khởi tạo: nút chọn ảnh và cảnh báo bắt buộc có ít nhất 1 ảnh', () => {
    render(<PhotoUploader photos={[]} onChange={vi.fn()} />);

    expect(screen.getByText(/Hình ảnh sản phẩm/i)).toBeInTheDocument();
    expect(screen.getByTestId('photo-counter')).toHaveTextContent('0/5 ảnh');
    expect(screen.getByText(/Bắt buộc có ít nhất 1 ảnh/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhấn để chọn ảnh từ thư viện hoặc máy ảnh/i)).toBeInTheDocument();
  });

  test('Chọn 1 ảnh JPG hợp lệ: gọi onChange với sortOrder = 1', () => {
    const handleChange = vi.fn();
    render(<PhotoUploader photos={[]} onChange={handleChange} />);

    const file = createMockFile('item.jpg', 1024 * 100, 'image/jpeg');
    const input = screen.getByTestId('photo-file-input');

    fireEvent.change(input, { target: { files: [file] } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    const updated = handleChange.mock.calls[0][0];
    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe('item.jpg');
    expect(updated[0].sortOrder).toBe(1);
  });

  test('Hiển thị ảnh xem trước (Preview) cùng nhãn Ảnh bìa và thứ tự', () => {
    const mockPhotos = [
      { id: '1', name: 'photo1.jpg', size: 1024 * 200, previewUrl: 'blob:p1', sortOrder: 1 },
      { id: '2', name: 'photo2.png', size: 1024 * 300, previewUrl: 'blob:p2', sortOrder: 2 },
    ];

    render(<PhotoUploader photos={mockPhotos} onChange={vi.fn()} />);

    expect(screen.getByTestId('photo-counter')).toHaveTextContent('2/5 ảnh');
    expect(screen.getAllByText(/Ảnh bìa/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('photo1.jpg')).toBeInTheDocument();
    expect(screen.getByText('photo2.png')).toBeInTheDocument();
  });

  test('Xóa ảnh (Delete): loại bỏ ảnh và tính lại sortOrder tuần tự', () => {
    const handleChange = vi.fn();
    const mockPhotos = [
      { id: 'p1', name: 'photo1.jpg', size: 1024, previewUrl: 'blob:p1', sortOrder: 1 },
      { id: 'p2', name: 'photo2.jpg', size: 1024, previewUrl: 'blob:p2', sortOrder: 2 },
      { id: 'p3', name: 'photo3.jpg', size: 1024, previewUrl: 'blob:p3', sortOrder: 3 },
    ];

    render(<PhotoUploader photos={mockPhotos} onChange={handleChange} />);

    // Xóa ảnh thứ 2 (index 1)
    const deleteBtn = screen.getByTestId('delete-photo-1');
    fireEvent.click(deleteBtn);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const result = handleChange.mock.calls[0][0];
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('p1');
    expect(result[0].sortOrder).toBe(1);
    expect(result[1].id).toBe('p3');
    expect(result[1].sortOrder).toBe(2); // Cập nhật lại sortOrder = 2
  });

  test('Đổi thứ tự ảnh (sort_order): di chuyển sang trái / sang phải', () => {
    const handleChange = vi.fn();
    const mockPhotos = [
      { id: 'p1', name: 'photo1.jpg', previewUrl: 'blob:p1', sortOrder: 1 },
      { id: 'p2', name: 'photo2.jpg', previewUrl: 'blob:p2', sortOrder: 2 },
    ];

    render(<PhotoUploader photos={mockPhotos} onChange={handleChange} />);

    // Nút sang trái của ảnh đầu tiên bị disabled
    expect(screen.getByTestId('move-left-0')).toBeDisabled();
    // Nút sang phải của ảnh cuối cùng bị disabled
    expect(screen.getByTestId('move-right-1')).toBeDisabled();

    // Di chuyển ảnh 1 sang phải
    fireEvent.click(screen.getByTestId('move-right-0'));

    expect(handleChange).toHaveBeenCalledTimes(1);
    const reordered = handleChange.mock.calls[0][0];
    expect(reordered[0].id).toBe('p2');
    expect(reordered[0].sortOrder).toBe(1);
    expect(reordered[1].id).toBe('p1');
    expect(reordered[1].sortOrder).toBe(2);
  });

  test('Đặt làm ảnh bìa: đưa ảnh bất kỳ lên vị trí đầu tiên (sortOrder = 1)', () => {
    const handleChange = vi.fn();
    const mockPhotos = [
      { id: 'p1', name: 'photo1.jpg', previewUrl: 'blob:p1', sortOrder: 1 },
      { id: 'p2', name: 'photo2.jpg', previewUrl: 'blob:p2', sortOrder: 2 },
      { id: 'p3', name: 'photo3.jpg', previewUrl: 'blob:p3', sortOrder: 3 },
    ];

    render(<PhotoUploader photos={mockPhotos} onChange={handleChange} />);

    // Nhấn "Làm bìa" ở ảnh thứ 3 (index 2)
    const setCoverBtn = screen.getByTestId('set-cover-2');
    fireEvent.click(setCoverBtn);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const reordered = handleChange.mock.calls[0][0];
    expect(reordered[0].id).toBe('p3');
    expect(reordered[0].sortOrder).toBe(1);
  });

  test('Chặn quá 5 ảnh (BR-04): chọn 6 tệp hiển thị thông báo lỗi rõ ràng', () => {
    const handleChange = vi.fn();
    render(<PhotoUploader photos={[]} onChange={handleChange} />);

    const sixFiles = Array.from({ length: 6 }, (_, i) =>
      createMockFile(`photo${i}.jpg`, 1024, 'image/jpeg')
    );

    const input = screen.getByTestId('photo-file-input');
    fireEvent.change(input, { target: { files: sixFiles } });

    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('photo-error-alert')).toHaveTextContent(/tối đa 5 ảnh/i);
  });

  test('Chặn sai định dạng - tệp GIF (TC-06, E2): hiển thị thông báo từ chối GIF', () => {
    const handleChange = vi.fn();
    render(<PhotoUploader photos={[]} onChange={handleChange} />);

    const gifFile = createMockFile('anim.gif', 1024 * 50, 'image/gif');
    const input = screen.getByTestId('photo-file-input');

    fireEvent.change(input, { target: { files: [gifFile] } });

    expect(handleChange).not.toHaveBeenCalled();
    const alert = screen.getByTestId('photo-error-alert');
    expect(alert).toHaveTextContent(/định dạng GIF không được chấp nhận/i);
  });

  test('Chặn sai định dạng - tệp PDF / WebP (E2): hiển thị lỗi định dạng không hợp lệ', () => {
    const handleChange = vi.fn();
    render(<PhotoUploader photos={[]} onChange={handleChange} />);

    const pdfFile = createMockFile('document.pdf', 1024 * 50, 'application/pdf');
    const input = screen.getByTestId('photo-file-input');

    fireEvent.change(input, { target: { files: [pdfFile] } });

    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('photo-error-alert')).toHaveTextContent(/không hợp lệ/i);
  });

  test('Chặn quá 5 MB (TC-06, BR-04, E2): chọn ảnh 6 MB hiển thị lỗi dung lượng', () => {
    const handleChange = vi.fn();
    render(<PhotoUploader photos={[]} onChange={handleChange} />);

    const sixMbFile = createMockFile('huge.jpg', 6 * 1024 * 1024, 'image/jpeg');
    const input = screen.getByTestId('photo-file-input');

    fireEvent.change(input, { target: { files: [sixMbFile] } });

    expect(handleChange).not.toHaveBeenCalled();
    const alert = screen.getByTestId('photo-error-alert');
    expect(alert).toHaveTextContent(/vượt quá giới hạn tối đa 5 MB/i);
  });

  test('Chặn tệp rỗng 0 bytes: hiển thị thông báo tệp rỗng', () => {
    const handleChange = vi.fn();
    render(<PhotoUploader photos={[]} onChange={handleChange} />);

    const emptyFile = createMockFile('empty.png', 0, 'image/png');
    const input = screen.getByTestId('photo-file-input');

    fireEvent.change(input, { target: { files: [emptyFile] } });

    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('photo-error-alert')).toHaveTextContent(/rỗng/i);
  });

  test('Ẩn khu vực tải ảnh khi đã đạt tối đa 5 ảnh', () => {
    const fivePhotos = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      name: `photo${i}.jpg`,
      size: 1024,
      previewUrl: `blob:p${i}`,
      sortOrder: i + 1,
    }));

    render(<PhotoUploader photos={fivePhotos} onChange={vi.fn()} />);

    expect(screen.getByTestId('photo-counter')).toHaveTextContent('5/5 ảnh');
    expect(screen.queryByTestId('dropzone')).not.toBeInTheDocument();
  });

  test('Format helper formatFileSize chuyển đổi đúng định dạng dung lượng', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});
