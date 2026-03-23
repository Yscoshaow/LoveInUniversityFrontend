import AppIntents
import WidgetKit

// MARK: - Managed Lock Entity

struct ManagedLockEntity: AppEntity {
    let id: String
    let lockId: Int64
    let wearerName: String
    let lockType: String
    let status: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "管理锁"

    static var defaultQuery = ManagedLockQuery()

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(wearerName) - \(localizedLockType)")
    }

    private var localizedLockType: String {
        switch lockType {
        case "SHARED": return "共享锁"
        case "PRIVATE": return "私有锁"
        default: return "自锁"
        }
    }
}

// MARK: - Entity Query

struct ManagedLockQuery: EntityQuery {
    func entities(for identifiers: [ManagedLockEntity.ID]) async throws -> [ManagedLockEntity] {
        let allEntities = try await suggestedEntities()
        return allEntities.filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [ManagedLockEntity] {
        guard let token = SharedDataManager.getToken() else { return [] }
        let locks = await WidgetNetworkManager.fetchManagedLocks(token: token)
        return locks.map { lock in
            ManagedLockEntity(
                id: "\(lock.lockId)",
                lockId: lock.lockId,
                wearerName: lock.wearerName ?? "User #\(lock.wearerId)",
                lockType: lock.lockType,
                status: lock.status
            )
        }
    }
}

// MARK: - Configuration Intent

struct SelectManagedLockIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "选择管理锁"
    static var description = IntentDescription("选择要显示的管理锁")

    @Parameter(title: "锁")
    var lock: ManagedLockEntity?
}
