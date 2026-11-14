/**
 * ConditionScorer Component (TE9C745, UC-05, FR-08, BR-01, BR-02, E3).
 * Thành phần tự chấm 3 điểm tình trạng món đồ cũ cho người bán:
 *  - 3 thanh trượt và ô nhập số 0–10 (Ngoại quan 40%, Chức năng 40%, Phụ kiện 20%).
 *  - Điểm tổng tạm tính và xếp hạng theo BR-01, BR-02 (Như mới, Tốt, Khá, Cũ).
 *  - Gợi ý cách chấm chi tiết (đặc biệt: đồ không có chức năng thì 'Chức năng' là độ nguyên vẹn).
 *  - Chặn giá trị ngoài 0–10 với thông báo lỗi rõ ràng (E3).
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Info,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ShieldAlert,
} from 'lucide-react';

export const calculateTotalScore = (appearance, functionScore, accessories) => {
  const app = parseFloat(appearance) || 0;
  const fn = parseFloat(functionScore) || 0;
  const acc = parseFloat(accessories) || 0;
  const total = 0.4 * app + 0.4 * fn + 0.2 * acc;
  return Math.round(total * 10) / 10;
};

export const getConditionRank = (totalScore) => {
  const score = parseFloat(totalScore) || 0;
  if (score >= 9.0) {
    return {
      rank: 'Như mới',
      key: 'LIKE_NEW',
      color: 'bg-emerald-600 text-white',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Chất lượng xuất sắc, gần như nguyên vẹn như lúc mới mua.',
    };
  }
  if (score >= 7.0) {
    return {
      rank: 'Tốt',
      key: 'GOOD',
      color: 'bg-blue-600 text-white',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Hoạt động tốt, ngoại quan đẹp, xước nhẹ khó thấy.',
    };
  }
  if (score >= 5.0) {
    return {
      rank: 'Khá',
      key: 'FAIR',
      color: 'bg-amber-500 text-white',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      description: 'Sử dụng bình thường, có hao mòn tự nhiên theo thời gian.',
    };
  }
  return {
    rank: 'Cũ',
    key: 'POOR',
    color: 'bg-slate-600 text-white',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
    description: 'Ngoại quan hoặc kết cấu đã xuống cấp nhiều.',
  };
};

export const validateComponentScore = (value, fieldName = 'Điểm') => {
  if (value === '' || value === null || value === undefined) {
    return `${fieldName} không được để trống (E3).`;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return `${fieldName} phải là một con số từ 0 đến 10 (E3).`;
  }
  if (num < 0 || num > 10) {
    return `${fieldName} phải nằm trong khoảng từ 0 đến 10 (E3).`;
  }
  return null;
};

export default function ConditionScorer({
  values = { appearance: 8.0, function: 8.0, accessories: 8.0 },
  onChange,
  errors = {},
}) {
  const [showGuide, setShowGuide] = useState(false);

  const appearance = values.appearance !== undefined ? values.appearance : 8.0;
  const functionScore = values.function !== undefined ? values.function : 8.0;
  const accessories = values.accessories !== undefined ? values.accessories : 8.0;

  const handleScoreChange = (field, rawValue) => {
    let parsed = rawValue;
    if (rawValue !== '') {
      const num = parseFloat(rawValue);
      parsed = isNaN(num) ? rawValue : num;
    }

    if (onChange) {
      onChange({
        ...values,
        [field]: parsed,
      });
    }
  };

  // Tính toán điểm tổng tạm tính và xếp hạng theo BR-01, BR-02
  const totalScore = calculateTotalScore(appearance, functionScore, accessories);
  const conditionRank = getConditionRank(totalScore);

  // Kiểm tra lỗi E3 client-side
  const appError = errors.appearance || validateComponentScore(appearance, 'Điểm ngoại quan');
  const funcError = errors.function || validateComponentScore(functionScore, 'Điểm chức năng');
  const accError = errors.accessories || validateComponentScore(accessories, 'Điểm phụ kiện');

  const hasAnyError = Boolean(appError || funcError || accError);

  return (
    <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs" data-testid="condition-scorer">
      {/* Tiêu đề & Kết quả tạm tính */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800">
              Đánh giá tình trạng món đồ
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold">
              BR-01 & BR-02
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự chấm 3 điểm thành phần từ 0 đến 10 để hệ thống ước tính hạng món đồ
          </p>
        </div>

        {/* Thẻ hiển thị điểm tổng tạm tính và phân hạng */}
        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200" data-testid="total-score-card">
          <div className="text-right">
            <div className="text-[11px] text-slate-500 font-medium">Điểm tổng tạm tính</div>
            <div className="text-base font-extrabold text-slate-800">
              {hasAnyError ? '--' : totalScore.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 10</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-1" />
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold shadow-xs ${conditionRank.color}`}
            data-testid="condition-rank-badge"
          >
            {conditionRank.rank}
          </span>
        </div>
      </div>

      {/* Thông báo lỗi ngoài khoảng 0-10 (E3) */}
      {hasAnyError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs animate-in fade-in"
          data-testid="e3-error-alert"
        >
          <ShieldAlert size={16} className="shrink-0 mt-0.5 text-red-600" />
          <div className="space-y-0.5">
            <span className="font-bold">Lỗi nhập điểm (E3):</span>
            {appError && <div>• {appError}</div>}
            {funcError && <div>• {funcError}</div>}
            {accError && <div>• {accError}</div>}
          </div>
        </div>
      )}

      {/* 3 Thanh trượt & Ô nhập điểm */}
      <div className="space-y-5">
        {/* 1. Điểm Ngoại quan (40%) */}
        <div
          className={`p-4 rounded-xl border transition-colors ${
            appError ? 'border-red-300 bg-red-50/20' : 'border-slate-200 bg-slate-50/60'
          }`}
          data-testid="score-appearance-group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label htmlFor="score-appearance-input" className="text-sm font-semibold text-slate-800">
                1. Ngoại quan
              </label>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                Trọng số 40%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="score-appearance-input"
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={appearance}
                onChange={(e) => handleScoreChange('appearance', e.target.value)}
                className={`w-16 px-2.5 py-1 text-center font-bold rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                  appError
                    ? 'border-red-400 text-red-700 focus:ring-red-200 bg-red-50'
                    : 'border-slate-300 text-slate-800 focus:border-emerald-500 focus:ring-emerald-200 bg-white'
                }`}
                aria-label="Điểm ngoại quan"
                data-testid="score-appearance-input"
              />
              <span className="text-xs text-slate-400 font-medium">/ 10</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={Math.min(10, Math.max(0, Number(appearance) || 0))}
            onChange={(e) => handleScoreChange('appearance', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            data-testid="score-appearance-slider"
            aria-label="Thanh trượt điểm ngoại quan"
          />

          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>0 (Trầy xước nặng, móp méo)</span>
            <span>5 (Bình thường, xước dăm)</span>
            <span>10 (Như mới, không tì vết)</span>
          </div>
        </div>

        {/* 2. Điểm Chức năng (40%) */}
        <div
          className={`p-4 rounded-xl border transition-colors ${
            funcError ? 'border-red-300 bg-red-50/20' : 'border-slate-200 bg-slate-50/60'
          }`}
          data-testid="score-function-group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label htmlFor="score-function-input" className="text-sm font-semibold text-slate-800">
                2. Chức năng / Độ nguyên vẹn
              </label>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                Trọng số 40%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="score-function-input"
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={functionScore}
                onChange={(e) => handleScoreChange('function', e.target.value)}
                className={`w-16 px-2.5 py-1 text-center font-bold rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                  funcError
                    ? 'border-red-400 text-red-700 focus:ring-red-200 bg-red-50'
                    : 'border-slate-300 text-slate-800 focus:border-emerald-500 focus:ring-emerald-200 bg-white'
                }`}
                aria-label="Điểm chức năng"
                data-testid="score-function-input"
              />
              <span className="text-xs text-slate-400 font-medium">/ 10</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={Math.min(10, Math.max(0, Number(functionScore) || 0))}
            onChange={(e) => handleScoreChange('function', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            data-testid="score-function-slider"
            aria-label="Thanh trượt điểm chức năng"
          />

          <p className="text-[11px] text-emerald-700 bg-emerald-50/60 p-2 rounded-lg mt-2 border border-emerald-100">
            💡 <strong>Gợi ý:</strong> Với đồ không có chức năng điện tử (bàn ghế, quần áo, sách truyện...), điểm này thể hiện <strong>độ nguyên vẹn, kết cấu chắc chắn, không rách gãy</strong>.
          </p>
        </div>

        {/* 3. Điểm Phụ kiện (20%) */}
        <div
          className={`p-4 rounded-xl border transition-colors ${
            accError ? 'border-red-300 bg-red-50/20' : 'border-slate-200 bg-slate-50/60'
          }`}
          data-testid="score-accessories-group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label htmlFor="score-accessories-input" className="text-sm font-semibold text-slate-800">
                3. Phụ kiện kèm theo
              </label>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                Trọng số 20%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="score-accessories-input"
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={accessories}
                onChange={(e) => handleScoreChange('accessories', e.target.value)}
                className={`w-16 px-2.5 py-1 text-center font-bold rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                  accError
                    ? 'border-red-400 text-red-700 focus:ring-red-200 bg-red-50'
                    : 'border-slate-300 text-slate-800 focus:border-emerald-500 focus:ring-emerald-200 bg-white'
                }`}
                aria-label="Điểm phụ kiện"
                data-testid="score-accessories-input"
              />
              <span className="text-xs text-slate-400 font-medium">/ 10</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={Math.min(10, Math.max(0, Number(accessories) || 0))}
            onChange={(e) => handleScoreChange('accessories', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            data-testid="score-accessories-slider"
            aria-label="Thanh trượt điểm phụ kiện"
          />

          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>0 (Món đồ trần, không phụ kiện)</span>
            <span>5 (Có phụ kiện cơ bản)</span>
            <span>10 (Fullbox, đầy đủ phụ kiện zin)</span>
          </div>
        </div>
      </div>

      {/* Nút bật/tắt Hướng dẫn chi tiết cách chấm điểm */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between p-3 text-xs font-semibold text-slate-700 hover:bg-slate-100/70 transition-colors"
          data-testid="toggle-scoring-guide"
        >
          <span className="flex items-center gap-1.5">
            <HelpCircle size={15} className="text-emerald-600" />
            Xem hướng dẫn tiêu chuẩn tự chấm điểm (BR-01, BR-02)
          </span>
          {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showGuide && (
          <div className="p-3.5 pt-0 text-xs text-slate-600 space-y-2 border-t border-slate-200/60 bg-white" data-testid="scoring-guide-content">
            <p>
              • <strong>Điểm Ngoại quan (40%):</strong> Đánh giá mức độ trầy xước, móp méo, độ mới của bề mặt vỏ/nước sơn bên ngoài.
            </p>
            <p>
              • <strong>Điểm Chức năng (40%):</strong> Đánh giá khả năng hoạt động tốt hay chập chờn. Với đồ dùng gia dụng, đồ gỗ, sách vở thì đây là <strong>độ nguyên vẹn, cứng cáp, không rách gãy</strong>.
            </p>
            <p>
              • <strong>Điểm Phụ kiện (20%):</strong> Còn hộp gốc, dây sạc zin, ốc vít, chân đế, sách hướng dẫn kèm theo hay chỉ có sản phẩm đơn lẻ.
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px]">
              ⚠️ <strong>Lưu ý quan trọng:</strong> Điểm tạm tính phía trên chỉ mang tính tham khảo cho người bán. Khi gửi duyệt, <strong>Server sẽ tính lại điểm tổng độc lập</strong> và Admin sẽ đối chiếu với hình ảnh thực tế, có quyền hạ điểm nếu không khớp (BR-01, BR-02).
            </div>
          </div>
        )}
      </div>

      {/* Hộp ghi chú Server tính lại (BR-01) */}
      <div className="p-3 rounded-xl bg-slate-100 text-slate-600 text-xs flex items-center gap-2">
        <Info size={16} className="text-slate-500 shrink-0" />
        <span>Điểm tổng và hạng chỉ để tham khảo, Server sẽ tính toán lại khi tiếp nhận tin đăng (BR-01).</span>
      </div>
    </div>
  );
}
