from app.services.evaluation.grader import Grader


def test_fallback_grade_is_normalized_and_evidence_bound():
    answer = "I measured queue latency, found lock contention, changed the design, and verified a forty percent reduction."
    result = Grader._deterministic_grade([answer])
    assert 0 <= result.overall_score <= 100
    assert sum(item.weight for item in result.dimensions) == 1
    assert result.dimensions[0].evidence[0] in answer


def test_model_evidence_not_spoken_by_candidate_is_removed():
    result = Grader._deterministic_grade(["Candidate evidence statement"])
    result.dimensions[0].evidence = ["An interviewer question"]
    result.dimensions[0].confidence = 0.9
    checked = Grader._enforce_evidence(result, ["Candidate evidence statement"])
    assert checked.dimensions[0].evidence == []
    assert checked.dimensions[0].confidence == 0.3
