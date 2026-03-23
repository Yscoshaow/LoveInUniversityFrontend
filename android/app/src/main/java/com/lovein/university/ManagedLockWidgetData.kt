package com.lovein.university

data class ManagedLockSummary(
    val lockId: Long,
    val wearerId: Long,
    val wearerName: String?,
    val wearerAvatar: String?,
    val wearerTelegramId: Long?,
    val wearerUsername: String?,
    val lockType: String,          // SELF, SHARED, PRIVATE
    val status: String,            // ACTIVE, UNLOCKING, UNLOCKED, EXPIRED, CANCELLED
    val remainingSeconds: Long?,
    val isFrozen: Boolean,
    val isHygieneOpening: Boolean,
    val permission: String,        // READ_ONLY, BASIC_CONTROL, FULL_CONTROL
    val createdAt: String
)
