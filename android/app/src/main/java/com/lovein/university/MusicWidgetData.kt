package com.lovein.university

data class MusicWidgetData(
    val trackHash: String,
    val trackTitle: String,
    val workTitle: String,
    val coverUrl: String,
    val playing: Boolean,
    var currentTime: Double,
    val duration: Double,
    val currentIndex: Int,
    val playlistSize: Int,
    val lastUpdated: Long,
    val subtitleText: String = ""
)
