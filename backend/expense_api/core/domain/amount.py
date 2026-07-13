"""금액 계산 (lib/schemas/expense-schema.ts 이전, CLAUDE.md Key Pattern #2).

현재 정본: amount = unitPrice × quantity (서버에서 재계산해 조작 방지).
requestAmount = Σ amount.
"""


def calculate_amount(unit_price: int, quantity: int) -> int:
    return unit_price * quantity


def calculate_request_amount(amounts: list[int]) -> int:
    return sum(amounts)
