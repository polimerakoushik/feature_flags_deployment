"""Import models here so ``import models`` registers every table with Base."""

from .audit_log import AuditLog
from .environment import Environment
from .environment_flag_override import EnvironmentFlagOverride
from .flag import Flag
from .flag_target_user import FlagTargetUser
from .flag_target_group import FlagTargetGroup
from .flag_version import FlagVersion
from .flag_history import FlagHistory
from .targeting_rule import TargetingRule
from .user import User
from .user_group import UserGroup
from .user_group_membership import UserGroupMembership
from .evaluation_metric import EvaluationMetric
from .admin_setting import AdminSetting
from .cleanup_candidate import CleanupCandidate

__all__ = [
    "AuditLog",
    "Environment",
    "EnvironmentFlagOverride",
    "Flag",
    "FlagTargetUser",
    "FlagTargetGroup",
    "FlagVersion",
    "FlagHistory",
    "TargetingRule",
    "User",
    "UserGroup",
    "UserGroupMembership",
    "EvaluationMetric",
    "AdminSetting",
    "CleanupCandidate",
]
