import pytest

from shared.circuit_breaker import CircuitOpenError, CircuitState, InMemoryCircuitBreaker


def test_starts_closed():
    breaker = InMemoryCircuitBreaker()
    assert breaker.get_state("provider-a") == CircuitState.CLOSED
    breaker.before_call("provider-a", failure_threshold=3, cooldown_seconds=60)


def test_opens_after_reaching_failure_threshold():
    breaker = InMemoryCircuitBreaker()
    breaker.record_failure("provider-a", failure_threshold=3)
    breaker.record_failure("provider-a", failure_threshold=3)
    assert breaker.get_state("provider-a") == CircuitState.CLOSED
    new_state = breaker.record_failure("provider-a", failure_threshold=3)
    assert new_state == CircuitState.OPEN
    assert breaker.get_state("provider-a") == CircuitState.OPEN


def test_before_call_raises_while_open_and_within_cooldown():
    breaker = InMemoryCircuitBreaker()
    for _ in range(3):
        breaker.record_failure("provider-a", failure_threshold=3)

    with pytest.raises(CircuitOpenError):
        breaker.before_call("provider-a", failure_threshold=3, cooldown_seconds=60)


def test_moves_to_half_open_after_cooldown_elapses():
    breaker = InMemoryCircuitBreaker()
    for _ in range(3):
        breaker.record_failure("provider-a", failure_threshold=3)

    state = breaker.before_call("provider-a", failure_threshold=3, cooldown_seconds=0)
    assert state == CircuitState.HALF_OPEN


def test_success_in_half_open_closes_the_circuit():
    breaker = InMemoryCircuitBreaker()
    for _ in range(3):
        breaker.record_failure("provider-a", failure_threshold=3)
    breaker.before_call("provider-a", failure_threshold=3, cooldown_seconds=0)

    new_state = breaker.record_success("provider-a")
    assert new_state == CircuitState.CLOSED
    assert breaker.get_state("provider-a") == CircuitState.CLOSED
    # depois de fechado, uma nova sequência de falhas precisa do threshold inteiro
    # de novo — sucesso zera o contador acumulado
    breaker.record_failure("provider-a", failure_threshold=3)
    assert breaker.get_state("provider-a") == CircuitState.CLOSED


def test_failure_in_half_open_reopens_immediately_without_needing_full_threshold():
    breaker = InMemoryCircuitBreaker()
    for _ in range(3):
        breaker.record_failure("provider-a", failure_threshold=3)
    breaker.before_call("provider-a", failure_threshold=3, cooldown_seconds=0)

    new_state = breaker.record_failure("provider-a", failure_threshold=3)
    assert new_state == CircuitState.OPEN


def test_circuits_are_independent_per_key():
    breaker = InMemoryCircuitBreaker()
    for _ in range(3):
        breaker.record_failure("provider-a", failure_threshold=3)
    assert breaker.get_state("provider-a") == CircuitState.OPEN
    assert breaker.get_state("provider-b") == CircuitState.CLOSED
