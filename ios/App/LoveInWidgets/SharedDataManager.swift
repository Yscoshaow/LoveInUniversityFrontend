import Foundation
import Security
import UIKit

struct SharedDataManager {
    static let appGroupId = "group.com.lovein.university"
    static let apiBase = "https://university.lovein.fun/api/v1"

    // UserDefaults keys (mirror Android PREFS_NAME / KEY_* pattern)
    static let keyJwtToken = "jwt_token"
    static let keyMusicData = "music_widget_data"
    static let keyPendingCommand = "music_pending_command"
    static let keyCachedLock = "cached_lock_json"
    static let keyScheduleItems = "schedule_widget_items"
    static let keyScheduleStats = "schedule_widget_stats"
    static let keyManagedPrefix = "managed_lock_widget_"

    // Darwin notification names
    static let musicCommandNotification = "com.lovein.university.musicCommand" as CFString

    static var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    // MARK: - Token (UserDefaults for widget access)

    static func setToken(_ token: String) {
        sharedDefaults?.set(token, forKey: keyJwtToken)
        sharedDefaults?.synchronize()
        setTokenKeychain(token)
    }

    static func getToken() -> String? {
        return sharedDefaults?.string(forKey: keyJwtToken)
    }

    static func clearToken() {
        sharedDefaults?.removeObject(forKey: keyJwtToken)
        sharedDefaults?.synchronize()
        clearTokenKeychain()
    }

    // MARK: - Token (Keychain for secure storage)

    static func setTokenKeychain(_ token: String) {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "jwt_token",
            kSecAttrService as String: "com.lovein.university",
            kSecAttrAccessGroup as String: appGroupId,
        ]
        SecItemDelete(query as CFDictionary)
        var addQuery = query
        addQuery[kSecValueData as String] = data
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    static func getTokenKeychain() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "jwt_token",
            kSecAttrService as String: "com.lovein.university",
            kSecAttrAccessGroup as String: appGroupId,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func clearTokenKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "jwt_token",
            kSecAttrService as String: "com.lovein.university",
            kSecAttrAccessGroup as String: appGroupId,
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - Music Data

    static func setMusicData(_ data: MusicWidgetData) {
        guard let encoded = try? JSONEncoder().encode(data) else { return }
        sharedDefaults?.set(encoded, forKey: keyMusicData)
        sharedDefaults?.synchronize()
    }

    static func getMusicData() -> MusicWidgetData? {
        guard let data = sharedDefaults?.data(forKey: keyMusicData) else { return nil }
        return try? JSONDecoder().decode(MusicWidgetData.self, from: data)
    }

    static func clearMusicData() {
        sharedDefaults?.removeObject(forKey: keyMusicData)
        sharedDefaults?.synchronize()
    }

    // MARK: - Pending Music Command

    static func setPendingCommand(_ command: String) {
        sharedDefaults?.set(command, forKey: keyPendingCommand)
        sharedDefaults?.synchronize()
    }

    static func consumePendingCommand() -> String? {
        let command = sharedDefaults?.string(forKey: keyPendingCommand)
        if command != nil {
            sharedDefaults?.removeObject(forKey: keyPendingCommand)
            sharedDefaults?.synchronize()
        }
        return command
    }

    // MARK: - Lock Data

    static func setCachedLock(_ data: LockWidgetData) {
        guard let encoded = try? JSONEncoder().encode(data) else { return }
        sharedDefaults?.set(encoded, forKey: keyCachedLock)
        sharedDefaults?.synchronize()
    }

    static func getCachedLock() -> LockWidgetData? {
        guard let data = sharedDefaults?.data(forKey: keyCachedLock) else { return nil }
        return try? JSONDecoder().decode(LockWidgetData.self, from: data)
    }

    static func clearCachedLock() {
        sharedDefaults?.removeObject(forKey: keyCachedLock)
        sharedDefaults?.synchronize()
    }

    // MARK: - Schedule Data

    static func setScheduleItems(_ items: [ScheduleWidgetItem]) {
        guard let encoded = try? JSONEncoder().encode(items) else { return }
        sharedDefaults?.set(encoded, forKey: keyScheduleItems)
        sharedDefaults?.synchronize()
    }

    static func getScheduleItems() -> [ScheduleWidgetItem]? {
        guard let data = sharedDefaults?.data(forKey: keyScheduleItems) else { return nil }
        return try? JSONDecoder().decode([ScheduleWidgetItem].self, from: data)
    }

    static func setScheduleStats(_ stats: ScheduleStats) {
        guard let encoded = try? JSONEncoder().encode(stats) else { return }
        sharedDefaults?.set(encoded, forKey: keyScheduleStats)
        sharedDefaults?.synchronize()
    }

    static func getScheduleStats() -> ScheduleStats? {
        guard let data = sharedDefaults?.data(forKey: keyScheduleStats) else { return nil }
        return try? JSONDecoder().decode(ScheduleStats.self, from: data)
    }

    // MARK: - Managed Lock Data

    static func setManagedLockData(widgetId: String, lock: ManagedLockSummary) {
        guard let encoded = try? JSONEncoder().encode(lock) else { return }
        sharedDefaults?.set(encoded, forKey: "\(keyManagedPrefix)\(widgetId)_data")
        sharedDefaults?.synchronize()
    }

    static func getManagedLockData(widgetId: String) -> ManagedLockSummary? {
        guard let data = sharedDefaults?.data(forKey: "\(keyManagedPrefix)\(widgetId)_data") else { return nil }
        return try? JSONDecoder().decode(ManagedLockSummary.self, from: data)
    }

    static func setManagedLockId(widgetId: String, lockId: Int64) {
        sharedDefaults?.set(lockId, forKey: "\(keyManagedPrefix)\(widgetId)_lock_id")
        sharedDefaults?.synchronize()
    }

    static func getManagedLockId(widgetId: String) -> Int64? {
        let val = sharedDefaults?.object(forKey: "\(keyManagedPrefix)\(widgetId)_lock_id") as? Int64
        return val
    }

    // MARK: - Live Activity Artwork (App Group file container)

    private static let liveActivityArtworkFileName = "live_activity_artwork.jpg"

    static func loadLiveActivityArtwork() -> UIImage? {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else { return nil }
        let fileURL = container.appendingPathComponent(liveActivityArtworkFileName)
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return UIImage(data: data)
    }
}
