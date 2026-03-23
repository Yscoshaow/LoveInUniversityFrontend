import WidgetKit
import SwiftUI

@main
struct LoveInWidgets: WidgetBundle {
    var body: some Widget {
        MusicWidget()
        MusicLiveActivity()
        LockWidget()
        ScheduleWidget()
        ManagedLockWidget()
    }
}
