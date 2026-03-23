package com.lovein.university

data class LockWidgetData(
    val id: Long,
    val userId: Long,
    val status: String,
    val lockType: String,
    var remainingSeconds: Long?,
    val remainingMinutes: Long?,
    val hideRemainingTime: Boolean,
    val isFrozen: Boolean,
    val isHygieneOpening: Boolean,
    val primaryKeyholderId: Long?,
    val likesReceived: Int,
    val lockBoxType: String,
    val lockBoxUnlocked: Boolean
)
