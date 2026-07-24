from modules.feature_flags.application.use_cases import IsFeatureEnabled, ListFeatureFlags, SetFeatureFlag
from modules.feature_flags.infrastructure.repository import InMemoryFeatureFlagRepository


def test_unknown_flag_is_disabled_by_default():
    flags = InMemoryFeatureFlagRepository()
    assert IsFeatureEnabled(flags).execute("nonexistent") is False


def test_disabled_flag_is_never_enabled_regardless_of_rollout():
    flags = InMemoryFeatureFlagRepository()
    SetFeatureFlag(flags).execute("promo_banner", enabled=False, rollout_percentage=100)
    assert IsFeatureEnabled(flags).execute("promo_banner", user_id="user-1") is False


def test_enabled_flag_at_full_rollout_is_always_enabled():
    flags = InMemoryFeatureFlagRepository()
    SetFeatureFlag(flags).execute("promo_banner", enabled=True, rollout_percentage=100)
    for user_id in ["user-1", "user-2", "user-3"]:
        assert IsFeatureEnabled(flags).execute("promo_banner", user_id=user_id) is True


def test_enabled_flag_at_zero_rollout_is_always_disabled():
    flags = InMemoryFeatureFlagRepository()
    SetFeatureFlag(flags).execute("promo_banner", enabled=True, rollout_percentage=0)
    for user_id in ["user-1", "user-2", "user-3"]:
        assert IsFeatureEnabled(flags).execute("promo_banner", user_id=user_id) is False


def test_partial_rollout_is_deterministic_for_the_same_user():
    flags = InMemoryFeatureFlagRepository()
    SetFeatureFlag(flags).execute("promo_banner", enabled=True, rollout_percentage=50)
    use_case = IsFeatureEnabled(flags)
    first_result = use_case.execute("promo_banner", user_id="stable-user")
    for _ in range(5):
        assert use_case.execute("promo_banner", user_id="stable-user") == first_result


def test_set_feature_flag_clamps_rollout_percentage_to_valid_range():
    flags = InMemoryFeatureFlagRepository()
    flag = SetFeatureFlag(flags).execute("x", enabled=True, rollout_percentage=150)
    assert flag.rollout_percentage == 100
    flag = SetFeatureFlag(flags).execute("y", enabled=True, rollout_percentage=-10)
    assert flag.rollout_percentage == 0


def test_list_feature_flags_returns_everything_set():
    flags = InMemoryFeatureFlagRepository()
    SetFeatureFlag(flags).execute("a", enabled=True)
    SetFeatureFlag(flags).execute("b", enabled=False)
    result = ListFeatureFlags(flags).execute()
    assert {f.key for f in result} == {"a", "b"}
