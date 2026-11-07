"""
Module ScoreCalculator (SDD mục 4, BR-01, BR-02, FR-08, UC-05, UC-09).
Tính điểm tổng tình trạng sản phẩm và phân hạng chất lượng tương ứng.
"""

from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Tuple, Union


class ConditionRank(str, Enum):
    """Bảng xếp hạng tình trạng sản phẩm theo BR-02."""
    LIKE_NEW = "Như mới"
    GOOD = "Tốt"
    FAIR = "Khá"
    POOR = "Cũ"


class ScoreCalculator:
    """
    Module dùng chung tính điểm tổng và hạng tình trạng món đồ cũ.
    Tuân thủ quy tắc BR-01 và BR-02:
      - Điểm tổng = 0,4 * Ngoại quan + 0,4 * Chức năng + 0,2 * Phụ kiện (làm tròn 1 chữ số thập phân).
      - Hạng:
        + >= 9.0: Như mới
        + 7.0 - 8.9: Tốt
        + 5.0 - 6.9: Khá
        + < 5.0: Cũ
    """

    MIN_SCORE = 0.0
    MAX_SCORE = 10.0

    @classmethod
    def validate_score(cls, score: Union[int, float, Decimal], score_name: str = "Điểm thành phần") -> Decimal:
        """Kiểm tra giá trị điểm phải nằm trong khoảng từ 0 đến 10."""
        try:
            val = Decimal(str(score))
        except Exception:
            raise ValueError(f"{score_name} không hợp lệ: {score}")

        if val < Decimal(str(cls.MIN_SCORE)) or val > Decimal(str(cls.MAX_SCORE)):
            raise ValueError(f"{score_name} phải nằm trong khoảng từ {cls.MIN_SCORE} đến {cls.MAX_SCORE}. Nhận được: {score}")
        return val

    @classmethod
    def calculate_total(
        cls,
        appearance: Union[int, float, Decimal],
        function: Union[int, float, Decimal],
        accessories: Union[int, float, Decimal],
    ) -> float:
        """
        Tính điểm tổng dựa trên công thức BR-01:
        Điểm tổng = làm tròn 1 chữ số của (0,4 * Ngoại quan + 0,4 * Chức năng + 0,2 * Phụ kiện).
        """
        app_dec = cls.validate_score(appearance, "Điểm ngoại quan")
        func_dec = cls.validate_score(function, "Điểm chức năng")
        acc_dec = cls.validate_score(accessories, "Điểm phụ kiện")

        weight_app = Decimal("0.4")
        weight_func = Decimal("0.4")
        weight_acc = Decimal("0.2")

        raw_total = (weight_app * app_dec) + (weight_func * func_dec) + (weight_acc * acc_dec)
        # Làm tròn 1 chữ số thập phân theo ROUND_HALF_UP (chuẩn toán học)
        rounded_total = raw_total.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
        return float(rounded_total)

    @classmethod
    def get_rank(cls, total_score: Union[int, float, Decimal]) -> str:
        """
        Xác định hạng tình trạng theo BR-02:
          - Từ 9.0: Như mới
          - 7.0 đến 8.9: Tốt
          - 5.0 đến 6.9: Khá
          - Dưới 5.0: Cũ
        """
        score_dec = cls.validate_score(total_score, "Điểm tổng")

        if score_dec >= Decimal("9.0"):
            return ConditionRank.LIKE_NEW.value
        elif score_dec >= Decimal("7.0"):
            return ConditionRank.GOOD.value
        elif score_dec >= Decimal("5.0"):
            return ConditionRank.FAIR.value
        else:
            return ConditionRank.POOR.value

    @classmethod
    def calculate(
        cls,
        appearance: Union[int, float, Decimal],
        function: Union[int, float, Decimal],
        accessories: Union[int, float, Decimal],
    ) -> Tuple[float, str]:
        """
        Hàm tiện ích tính cả điểm tổng và hạng tình trạng.
        Trả về: (total_score, rank)
        """
        total = cls.calculate_total(appearance, function, accessories)
        rank = cls.get_rank(total)
        return total, rank
