import Foundation
import Combine

final class TopChromeState: ObservableObject {
    @Published var title: String = "Thinking Space"
    @Published var isVisible: Bool = true
    @Published var showSearch: Bool = true
    @Published var showCreate: Bool = true
}
