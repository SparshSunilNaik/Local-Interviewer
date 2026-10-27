from app.services.evaluation.grader import Grader


def test_fallback_grade_is_normalized_and_evidence_bound():
    answer = "I measured queue latency, found lock contention, changed the design, and verified a forty percent reduction."
    result = Grader._deterministic_grade([answer])
    assert 0 <= result.overall_score <= 100
    assert sum(item.weight for item in result.dimensions) == 1
    assert result.dimensions[0].evidence[0] in answer
