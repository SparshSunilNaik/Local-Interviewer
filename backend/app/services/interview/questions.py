CATEGORIES = [
    "General HR", "Behavioral", "Technical", "Software Engineering", "Python",
    "Backend Engineering", "Full-Stack Development", "Artificial Intelligence / Machine Learning",
    "Generative AI / LLM Engineering", "Agentic AI", "Computer Vision", "Robotics / VLA",
    "Data Structures and Algorithms", "System Design", "Custom interview",
]

COMMON = [
    ("introduction", "Please introduce yourself and tell me what drew you to this role."),
    ("reflection", "What is one skill you are deliberately improving right now, and how?"),
    ("candidate_questions", "What would you like to ask about the role or team?"),
]

QUESTION_BANK: dict[str, list[tuple[str, str]]] = {
    "General HR": [("motivation", "What matters most to you in your next role?"), ("collaboration", "Describe the environment in which you do your best work.")],
    "Behavioral": [("ownership", "Tell me about a time you took ownership of a difficult outcome."), ("conflict", "Walk me through a disagreement you handled constructively.")],
    "Technical": [("debugging", "Describe your systematic approach to diagnosing an unfamiliar technical failure."), ("tradeoffs", "How do you decide when a solution is sufficiently robust to ship?")],
    "Software Engineering": [("design", "How would you structure a service so it remains maintainable as the team grows?"), ("quality", "Tell me about a subtle production defect you found and how you prevented recurrence.")],
    "Python": [("runtime", "Explain Python's object model and how mutability can create surprising behavior."), ("concurrency", "When would you choose asyncio, threads, or processes in Python?")],
    "Backend Engineering": [("api", "Design an idempotent API for a payment-like operation."), ("reliability", "How would you make a service resilient to a slow downstream dependency?")],
    "Full-Stack Development": [("boundaries", "How do you decide which logic belongs in the browser versus the server?"), ("delivery", "Walk through shipping a user-facing feature from schema to accessible UI.")],
    "Artificial Intelligence / Machine Learning": [("evaluation", "How would you establish that a model improves on a meaningful baseline?"), ("drift", "How would you detect and respond to data or concept drift?")],
    "Generative AI / LLM Engineering": [("rag", "Design and evaluate a retrieval-augmented generation system for high-stakes documents."), ("inference", "What trade-offs govern latency, quality, and cost in LLM inference?")],
    "Agentic AI": [("control", "How would you constrain and evaluate an agent that can call external tools?"), ("memory", "What should an agent remember, and how would you prevent memory from becoming harmful?")],
    "Computer Vision": [("metrics", "How would you choose metrics for a highly imbalanced detection problem?"), ("deployment", "What changes when a vision model moves from a notebook to an edge device?")],
    "Robotics / VLA": [("safety", "How would you validate a learned policy before allowing it to control real hardware?"), ("generalization", "How would you diagnose poor sim-to-real transfer in a manipulation task?")],
    "Data Structures and Algorithms": [("complexity", "Given a stream too large for memory, how would you find frequent items?"), ("graphs", "How would you detect and explain a dependency cycle in a large graph?")],
    "System Design": [("scale", "Design a notification system that supports retries without duplicate delivery."), ("consistency", "Where would you accept eventual consistency in a collaborative application, and why?")],
    "Custom interview": [("objective", "What experience best demonstrates your fit for the objective of this interview?"), ("depth", "Choose a relevant project and explain the hardest decision you made.")],
}


def questions_for(category: str) -> list[tuple[str, str]]:
    return [COMMON[0], *QUESTION_BANK.get(category, QUESTION_BANK["Custom interview"]), *COMMON[1:]]
