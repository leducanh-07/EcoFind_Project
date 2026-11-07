import pytest
from app.services.score_calculator import ScoreCalculator, ConditionRank


def test_score_calculation_formula():
    """Kiểm tra công thức BR-01: (9, 8, 7) -> 8.2"""
    # 0.4 * 9 + 0.4 * 8 + 0.2 * 7 = 3.6 + 3.2 + 1.4 = 8.2
    total = ScoreCalculator.calculate_total(appearance=9, function=8, accessories=7)
    assert total == 8.2


def test_condition_rank_boundaries():
    """Kiểm tra phân hạng theo BR-02: Như mới, Tốt, Khá, Cũ và các mốc biên."""
    # Mốc >= 9.0: Như mới
    assert ScoreCalculator.get_rank(9.0) == ConditionRank.LIKE_NEW.value
    assert ScoreCalculator.get_rank(9.5) == ConditionRank.LIKE_NEW.value
    assert ScoreCalculator.get_rank(10.0) == ConditionRank.LIKE_NEW.value

    # Mốc 7.0 - 8.9: Tốt
    assert ScoreCalculator.get_rank(8.9) == ConditionRank.GOOD.value
    assert ScoreCalculator.get_rank(7.5) == ConditionRank.GOOD.value
    assert ScoreCalculator.get_rank(7.0) == ConditionRank.GOOD.value

    # Mốc 5.0 - 6.9: Khá
    assert ScoreCalculator.get_rank(6.9) == ConditionRank.FAIR.value
    assert ScoreCalculator.get_rank(5.5) == ConditionRank.FAIR.value
    assert ScoreCalculator.get_rank(5.0) == ConditionRank.FAIR.value

    # Mốc < 5.0: Cũ
    assert ScoreCalculator.get_rank(4.9) == ConditionRank.POOR.value
    assert ScoreCalculator.get_rank(3.0) == ConditionRank.POOR.value
    assert ScoreCalculator.get_rank(0.0) == ConditionRank.POOR.value


def test_score_calculator_calculate_helper():
    """Kiểm tra hàm helper calculate trả về cả điểm tổng và hạng."""
    total, rank = ScoreCalculator.calculate(9, 8, 7)
    assert total == 8.2
    assert rank == ConditionRank.GOOD.value

    total_new, rank_new = ScoreCalculator.calculate(10, 9, 8)
    assert total_new == 9.2
    assert rank_new == ConditionRank.LIKE_NEW.value


def test_score_outside_range_raises_value_error():
    """Kiểm tra điểm ngoài khoảng 0-10 báo lỗi ValueError."""
    # Điểm âm (< 0)
    with pytest.raises(ValueError, match="khoảng từ 0.0 đến 10.0"):
        ScoreCalculator.validate_score(-0.1)

    with pytest.raises(ValueError):
        ScoreCalculator.calculate_total(-1, 8, 7)

    with pytest.raises(ValueError):
        ScoreCalculator.calculate_total(9, -2, 7)

    with pytest.raises(ValueError):
        ScoreCalculator.calculate_total(9, 8, -0.5)

    # Điểm vượt quá 10 (> 10)
    with pytest.raises(ValueError, match="khoảng từ 0.0 đến 10.0"):
        ScoreCalculator.validate_score(10.1)

    with pytest.raises(ValueError):
        ScoreCalculator.calculate_total(11, 8, 7)

    with pytest.raises(ValueError):
        ScoreCalculator.calculate_total(9, 10.5, 7)

    with pytest.raises(ValueError):
        ScoreCalculator.calculate_total(9, 8, 15)

    # Giá trị không phải số
    with pytest.raises(ValueError):
        ScoreCalculator.validate_score("invalid")
