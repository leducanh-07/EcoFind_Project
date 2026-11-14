/**
 * Tests for ConditionScorer Component (TE9C745, UC-05, FR-08, BR-01, BR-02, E3).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConditionScorer, {
  calculateTotalScore,
  getConditionRank,
  validateComponentScore,
} from '../components/ConditionScorer';

describe('ConditionScorer Component (TE9C745, BR-01, BR-02, E3)', () => {
  test('Hàm calculateTotalScore tính điểm tổng theo công thức BR-01: 0.4*App + 0.4*Func + 0.2*Acc', () => {
    // TC-05: 9, 8, 7 -> 0.4*9 + 0.4*8 + 0.2*7 = 3.6 + 3.2 + 1.4 = 8.2
    expect(calculateTotalScore(9, 8, 7)).toBe(8.2);
    // Điểm tối đa: 10, 10, 10 -> 10.0
    expect(calculateTotalScore(10, 10, 10)).toBe(10.0);
    // Điểm tối thiểu: 0, 0, 0 -> 0.0
    expect(calculateTotalScore(0, 0, 0)).toBe(0.0);
    // Điểm thập phân: 8.5, 7.5, 6.0 -> 0.4*8.5 (3.4) + 0.4*7.5 (3.0) + 0.2*6.0 (1.2) = 7.6
    expect(calculateTotalScore(8.5, 7.5, 6.0)).toBe(7.6);
  });

  test('Hàm getConditionRank phân hạng chính xác theo BR-02', () => {
    // >= 9.0: Như mới
    expect(getConditionRank(10.0).rank).toBe('Như mới');
    expect(getConditionRank(9.0).rank).toBe('Như mới');

    // 7.0 đến 8.9: Tốt
    expect(getConditionRank(8.9).rank).toBe('Tốt');
    expect(getConditionRank(7.0).rank).toBe('Tốt');

    // 5.0 đến 6.9: Khá
    expect(getConditionRank(6.9).rank).toBe('Khá');
    expect(getConditionRank(5.0).rank).toBe('Khá');

    // < 5.0: Cũ
    expect(getConditionRank(4.9).rank).toBe('Cũ');
    expect(getConditionRank(0.0).rank).toBe('Cũ');
  });

  test('Hàm validateComponentScore kiểm tra hợp lệ và chặn giá trị ngoài 0–10 (E3)', () => {
    expect(validateComponentScore(5)).toBeNull();
    expect(validateComponentScore(0)).toBeNull();
    expect(validateComponentScore(10)).toBeNull();
    expect(validateComponentScore(7.5)).toBeNull();

    // Giá trị âm < 0
    expect(validateComponentScore(-1, 'Điểm ngoại quan')).toContain('từ 0 đến 10 (E3)');
    // Giá trị lớn hơn 10
    expect(validateComponentScore(10.5, 'Điểm chức năng')).toContain('từ 0 đến 10 (E3)');
    expect(validateComponentScore(15, 'Điểm phụ kiện')).toContain('từ 0 đến 10 (E3)');
    // Chuỗi rỗng hoặc không phải số
    expect(validateComponentScore('', 'Điểm')).toContain('không được để trống (E3)');
    expect(validateComponentScore('abc', 'Điểm')).toContain('từ 0 đến 10 (E3)');
  });

  test('Hiển thị đầy đủ 3 thanh trượt và ô nhập điểm với trọng số tương ứng', () => {
    render(<ConditionScorer values={{ appearance: 8, function: 8, accessories: 8 }} onChange={vi.fn()} />);

    expect(screen.getByText(/1. Ngoại quan/i)).toBeInTheDocument();
    expect(screen.getByText(/2. Chức năng \/ Độ nguyên vẹn/i)).toBeInTheDocument();
    expect(screen.getByText(/3. Phụ kiện kèm theo/i)).toBeInTheDocument();

    // Kiểm tra trọng số
    expect(screen.getAllByText(/Trọng số 40%/i)).toHaveLength(2);
    expect(screen.getByText(/Trọng số 20%/i)).toBeInTheDocument();

    // Kiểm tra 3 ô nhập
    expect(screen.getByTestId('score-appearance-input')).toHaveValue(8);
    expect(screen.getByTestId('score-function-input')).toHaveValue(8);
    expect(screen.getByTestId('score-accessories-input')).toHaveValue(8);

    // Kiểm tra 3 thanh trượt
    expect(screen.getByTestId('score-appearance-slider')).toHaveValue('8');
    expect(screen.getByTestId('score-function-slider')).toHaveValue('8');
    expect(screen.getByTestId('score-accessories-slider')).toHaveValue('8');
  });

  test('Hiển thị điểm tổng tạm tính và huy hiệu phân hạng (BR-01, BR-02)', () => {
    // 9.0, 9.0, 9.0 -> 9.0 (Như mới)
    const { rerender } = render(
      <ConditionScorer values={{ appearance: 9.0, function: 9.0, accessories: 9.0 }} onChange={vi.fn()} />
    );

    expect(screen.getByTestId('total-score-card')).toHaveTextContent('9.0');
    expect(screen.getByTestId('condition-rank-badge')).toHaveTextContent('Như mới');

    // Đổi sang 7.0, 7.0, 7.0 -> 7.0 (Tốt)
    rerender(
      <ConditionScorer values={{ appearance: 7.0, function: 7.0, accessories: 7.0 }} onChange={vi.fn()} />
    );
    expect(screen.getByTestId('total-score-card')).toHaveTextContent('7.0');
    expect(screen.getByTestId('condition-rank-badge')).toHaveTextContent('Tốt');

    // Đổi sang 4.0, 4.0, 4.0 -> 4.0 (Cũ)
    rerender(
      <ConditionScorer values={{ appearance: 4.0, function: 4.0, accessories: 4.0 }} onChange={vi.fn()} />
    );
    expect(screen.getByTestId('total-score-card')).toHaveTextContent('4.0');
    expect(screen.getByTestId('condition-rank-badge')).toHaveTextContent('Cũ');
  });

  test('Thay đổi giá trị ô nhập gọi onChange với giá trị mới', () => {
    const handleChange = vi.fn();
    render(<ConditionScorer values={{ appearance: 8, function: 8, accessories: 8 }} onChange={handleChange} />);

    const input = screen.getByTestId('score-appearance-input');
    fireEvent.change(input, { target: { value: '9.5' } });

    expect(handleChange).toHaveBeenCalledWith({
      appearance: 9.5,
      function: 8,
      accessories: 8,
    });
  });

  test('Thay đổi giá trị thanh trượt gọi onChange với giá trị mới', () => {
    const handleChange = vi.fn();
    render(<ConditionScorer values={{ appearance: 8, function: 8, accessories: 8 }} onChange={handleChange} />);

    const slider = screen.getByTestId('score-function-slider');
    fireEvent.change(slider, { target: { value: '6.5' } });

    expect(handleChange).toHaveBeenCalledWith({
      appearance: 8,
      function: 6.5,
      accessories: 8,
    });
  });

  test('Chặn và hiển thị lỗi E3 khi nhập giá trị ngoài 0–10', () => {
    render(
      <ConditionScorer
        values={{ appearance: -1, function: 12, accessories: 8 }}
        onChange={vi.fn()}
      />
    );

    const alert = screen.getByTestId('e3-error-alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/Lỗi nhập điểm \(E3\)/i);
    expect(alert).toHaveTextContent(/Điểm ngoại quan phải nằm trong khoảng từ 0 đến 10/i);
    expect(alert).toHaveTextContent(/Điểm chức năng phải nằm trong khoảng từ 0 đến 10/i);
  });

  test('Bật/tắt hướng dẫn chấm điểm và hiển thị nội dung gợi ý độ nguyên vẹn cho đồ không có chức năng', () => {
    render(<ConditionScorer values={{ appearance: 8, function: 8, accessories: 8 }} onChange={vi.fn()} />);

    // Mặc định nội dung hướng dẫn ẩn
    expect(screen.queryByTestId('scoring-guide-content')).not.toBeInTheDocument();

    // Bấm nút xem hướng dẫn
    const toggleBtn = screen.getByTestId('toggle-scoring-guide');
    fireEvent.click(toggleBtn);

    // Hiển thị nội dung hướng dẫn
    const guideContent = screen.getByTestId('scoring-guide-content');
    expect(guideContent).toBeInTheDocument();
    expect(guideContent).toHaveTextContent(/độ nguyên vẹn, cứng cáp, không rách gãy/i);
    expect(guideContent).toHaveTextContent(/Server sẽ tính lại điểm tổng độc lập/i);

    // Bấm lại để đóng
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('scoring-guide-content')).not.toBeInTheDocument();
  });

  test('Hiển thị ghi chú Server tính lại điểm và quyền kiểm duyệt của Admin (BR-01)', () => {
    render(<ConditionScorer values={{ appearance: 8, function: 8, accessories: 8 }} onChange={vi.fn()} />);
    expect(screen.getByText(/Điểm tổng và hạng chỉ để tham khảo, Server sẽ tính toán lại/i)).toBeInTheDocument();
  });
});
