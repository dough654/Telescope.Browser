import { serviceWorkerLogger } from '../../utils/logger.js'
import { stateManager, type SystemHealth } from '../state/state-manager.js'
import { storage } from '../storage/storage-layer.js'
import { messageBroker } from '../messaging/message-broker.js'
import { tabManager } from './tab-manager.js'
import { windowManager } from './window-manager.js'
import { screenshotManager } from './screenshot-manager.js'
import { harpoonManager } from './harpoon-manager.js'

export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'recovering'

export interface HealthCheckResult {
  status: HealthStatus
  components: ComponentHealth[]
  overallScore: number
  recommendations: string[]
  timestamp: number
}

export interface ComponentHealth {
  name: string
  status: HealthStatus
  score: number
  errors: string[]
  warnings: string[]
  lastCheck: number
}

export interface RecoveryAction {
  type: 'cleanup' | 'reset' | 'repair' | 'fallback'
  component: string
  description: string
  priority: 'high' | 'medium' | 'low'
  automated: boolean
}

export interface RecoveryPlan {
  actions: RecoveryAction[]
  estimatedTime: number
  riskLevel: 'low' | 'medium' | 'high'
  requiresUserConsent: boolean
}

/**
 * Error recovery and system health monitoring
 */
export class RecoveryManager {
  private healthCheckInterval: NodeJS.Timeout | null = null
  private isInSafeMode = false
  private lastHealthCheck: HealthCheckResult | null = null
  private recoveryInProgress = false
  private maxErrorCount = 50
  private healthCheckIntervalMs = 5 * 60 * 1000 // 5 minutes
  private criticalErrorThreshold = 10

  constructor() {
    this.setupHealthMonitoring()
  }

  /**
   * Initialize recovery manager
   */
  async initialize(): Promise<void> {
    try {
      // Initialize state manager first
      await stateManager.initialize()

      // Perform initial health check
      await this.checkHealth()

      // Setup error tracking
      this.setupErrorTracking()

      serviceWorkerLogger.info('Recovery manager initialized')
    } catch (error) {
      serviceWorkerLogger.error('Failed to initialize recovery manager:', error)
      throw error
    }
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthCheckResult> {
    try {
      const components: ComponentHealth[] = []
      let overallScore = 0
      const recommendations: string[] = []

      // Check storage health
      const storageHealth = await this.checkStorageHealth()
      components.push(storageHealth)

      // Check state manager health
      const stateHealth = await this.checkStateManagerHealth()
      components.push(stateHealth)

      // Check message broker health
      const messagingHealth = await this.checkMessagingHealth()
      components.push(messagingHealth)

      // Check tab manager health
      const tabHealth = await this.checkTabManagerHealth()
      components.push(tabHealth)

      // Check window manager health
      const windowHealth = await this.checkWindowManagerHealth()
      components.push(windowHealth)

      // Check screenshot manager health
      const screenshotHealth = await this.checkScreenshotManagerHealth()
      components.push(screenshotHealth)

      // Check harpoon manager health
      const harpoonHealth = await this.checkHarpoonManagerHealth()
      components.push(harpoonHealth)

      // Calculate overall score and status
      overallScore = components.reduce((sum, comp) => sum + comp.score, 0) / components.length

      const status = this.determineOverallStatus(components, overallScore)
      
      // Generate recommendations
      recommendations.push(...this.generateRecommendations(components))

      const result: HealthCheckResult = {
        status,
        components,
        overallScore,
        recommendations,
        timestamp: Date.now()
      }

      this.lastHealthCheck = result

      // Update system health
      await this.updateSystemHealth(result)

      serviceWorkerLogger.debug('Health check completed:', { status, score: overallScore })
      return result

    } catch (error) {
      serviceWorkerLogger.error('Health check failed:', error)
      
      const failedResult: HealthCheckResult = {
        status: 'critical',
        components: [],
        overallScore: 0,
        recommendations: ['System health check failed - manual intervention required'],
        timestamp: Date.now()
      }

      this.lastHealthCheck = failedResult
      return failedResult
    }
  }

  /**
   * Recover from system corruption
   */
  async recoverFromCorruption(): Promise<boolean> {
    if (this.recoveryInProgress) {
      serviceWorkerLogger.warn('Recovery already in progress')
      return false
    }

    this.recoveryInProgress = true
    serviceWorkerLogger.info('Starting corruption recovery')

    try {
      // Enter safe mode
      await this.enterSafeMode()

      // Create recovery plan
      const recoveryPlan = await this.createRecoveryPlan()

      // Execute recovery actions
      const success = await this.executeRecoveryPlan(recoveryPlan)

      if (success) {
        // Validate recovery
        const healthCheck = await this.checkHealth()
        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
          await this.exitSafeMode()
          serviceWorkerLogger.info('Recovery completed successfully')
          return true
        }
      }

      serviceWorkerLogger.error('Recovery failed')
      return false

    } catch (error) {
      serviceWorkerLogger.error('Recovery process failed:', error)
      return false
    } finally {
      this.recoveryInProgress = false
    }
  }

  /**
   * Enter safe mode
   */
  async enterSafeMode(): Promise<void> {
    try {
      this.isInSafeMode = true
      
      // Clear potentially corrupted data
      await this.clearVolatileData()

      // Reduce system activity
      this.reduceSystemActivity()

      // Notify all tabs about safe mode
      await messageBroker.broadcastToAllTabs('safeModeEntered', {
        timestamp: Date.now(),
        message: 'Extension is in safe mode due to detected issues'
      })

      serviceWorkerLogger.info('Entered safe mode')
    } catch (error) {
      serviceWorkerLogger.error('Failed to enter safe mode:', error)
      throw error
    }
  }

  /**
   * Exit safe mode
   */
  async exitSafeMode(): Promise<void> {
    try {
      this.isInSafeMode = false
      
      // Restore normal system activity
      this.restoreSystemActivity()

      // Notify all tabs about safe mode exit
      await messageBroker.broadcastToAllTabs('safeModeExited', {
        timestamp: Date.now(),
        message: 'Extension has exited safe mode'
      })

      serviceWorkerLogger.info('Exited safe mode')
    } catch (error) {
      serviceWorkerLogger.error('Failed to exit safe mode:', error)
      throw error
    }
  }

  /**
   * Validate system state
   */
  async validateSystemState(): Promise<boolean> {
    try {
      // Check data consistency
      const tabHistory = stateManager.getTabHistory()
      const harpoonTabs = stateManager.getHarpoonTabs()
      const windowStates = stateManager.getWindowStates()

      // Validate tab history
      if (!Array.isArray(tabHistory)) {
        serviceWorkerLogger.error('Tab history is not an array')
        return false
      }

      // Validate harpoon tabs
      if (!Array.isArray(harpoonTabs)) {
        serviceWorkerLogger.error('Harpoon tabs is not an array')
        return false
      }

      // Validate window states
      if (typeof windowStates !== 'object' || windowStates === null) {
        serviceWorkerLogger.error('Window states is not an object')
        return false
      }

      // Check for duplicate tabs
      const tabIds = new Set()
      for (const tab of [...tabHistory, ...harpoonTabs]) {
        if (tabIds.has(tab.id)) {
          serviceWorkerLogger.error(`Duplicate tab ID found: ${tab.id}`)
          return false
        }
        tabIds.add(tab.id)
      }

      // Validate tab data
      for (const tab of [...tabHistory, ...harpoonTabs]) {
        if (!tab.id || !tab.url || !tab.title || !tab.windowId) {
          serviceWorkerLogger.error('Invalid tab data found:', tab)
          return false
        }
      }

      serviceWorkerLogger.debug('System state validation passed')
      return true

    } catch (error) {
      serviceWorkerLogger.error('System state validation failed:', error)
      return false
    }
  }

  /**
   * Get current health status
   */
  getCurrentHealth(): HealthCheckResult | null {
    return this.lastHealthCheck
  }

  /**
   * Check if system is in safe mode
   */
  isInSafeModeStatus(): boolean {
    return this.isInSafeMode
  }

  /**
   * Schedule health check
   */
  scheduleHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth()
    }, this.healthCheckIntervalMs)
  }

  /**
   * Force immediate health check
   */
  async forceHealthCheck(): Promise<HealthCheckResult> {
    return await this.checkHealth()
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalRecoveries: number
    lastRecoveryTime: number
    safeModeCount: number
    errorCount: number
  } {
    const systemHealth = stateManager.getSystemHealth()
    
    return {
      totalRecoveries: 0, // Could be tracked in system health
      lastRecoveryTime: 0, // Could be tracked in system health
      safeModeCount: 0, // Could be tracked in system health
      errorCount: systemHealth.errorCount
    }
  }

  // Private methods

  private setupHealthMonitoring(): void {
    this.scheduleHealthCheck()
  }

  private setupErrorTracking(): void {
    // Track global errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleError(event.error)
      })

      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason)
      })
    }
  }

  private async handleError(error: Error): Promise<void> {
    try {
      // Update error count
      const systemHealth = stateManager.getSystemHealth()
      await stateManager.updateSystemHealth({
        errorCount: systemHealth.errorCount + 1
      })

      // Check if we've hit critical error threshold
      if (systemHealth.errorCount >= this.criticalErrorThreshold) {
        serviceWorkerLogger.error('Critical error threshold reached, initiating recovery')
        await this.recoverFromCorruption()
      }

    } catch (recoveryError) {
      serviceWorkerLogger.error('Failed to handle error:', recoveryError)
    }
  }

  private async checkStorageHealth(): Promise<ComponentHealth> {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    try {
      // Check storage quota
      const storageInfo = await storage.getStorageInfo()
      const usagePercent = (storageInfo.bytesInUse / storageInfo.quota) * 100

      if (usagePercent > 80) {
        warnings.push(`Storage usage is ${usagePercent.toFixed(1)}%`)
        score -= 10
      }

      if (usagePercent > 95) {
        errors.push('Storage quota nearly exceeded')
        score -= 30
      }

      // Test storage operations
      await storage.write('systemHealth', stateManager.getSystemHealth())

    } catch (error) {
      errors.push(`Storage operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      score -= 50
    }

    return {
      name: 'Storage',
      status: this.determineComponentStatus(score),
      score,
      errors,
      warnings,
      lastCheck: Date.now()
    }
  }

  private async checkStateManagerHealth(): Promise<ComponentHealth> {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    try {
      // Check state consistency
      const tabHistory = stateManager.getTabHistory()
      const harpoonTabs = stateManager.getHarpoonTabs()

      if (!Array.isArray(tabHistory)) {
        errors.push('Tab history is not an array')
        score -= 50
      }

      if (!Array.isArray(harpoonTabs)) {
        errors.push('Harpoon tabs is not an array')
        score -= 50
      }

      // Check for reasonable data sizes
      if (tabHistory.length > 1000) {
        warnings.push(`Large tab history: ${tabHistory.length} tabs`)
        score -= 10
      }

      if (harpoonTabs.length > 100) {
        warnings.push(`Large harpoon list: ${harpoonTabs.length} tabs`)
        score -= 10
      }

    } catch (error) {
      errors.push(`State manager check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      score -= 50
    }

    return {
      name: 'State Manager',
      status: this.determineComponentStatus(score),
      score,
      errors,
      warnings,
      lastCheck: Date.now()
    }
  }

  private async checkMessagingHealth(): Promise<ComponentHealth> {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    try {
      // Check message queue
      const queueSize = messageBroker.getQueueSize()
      
      if (queueSize > 100) {
        warnings.push(`Large message queue: ${queueSize} messages`)
        score -= 10
      }

      if (queueSize > 1000) {
        errors.push('Message queue is overflowing')
        score -= 30
      }

    } catch (error) {
      errors.push(`Messaging check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      score -= 50
    }

    return {
      name: 'Messaging',
      status: this.determineComponentStatus(score),
      score,
      errors,
      warnings,
      lastCheck: Date.now()
    }
  }

  private async checkTabManagerHealth(): Promise<ComponentHealth> {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    try {
      // Run tab cleanup
      await tabManager.cleanupInvalidTabs()

      // Check for reasonable tab counts
      const tabHistory = stateManager.getTabHistory()
      if (tabHistory.length === 0) {
        warnings.push('No tabs in history')
        score -= 5
      }

    } catch (error) {
      errors.push(`Tab manager check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      score -= 50
    }

    return {
      name: 'Tab Manager',
      status: this.determineComponentStatus(score),
      score,
      errors,
      warnings,
      lastCheck: Date.now()
    }
  }

  private async checkWindowManagerHealth(): Promise<ComponentHealth> {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    try {
      // Check window state consistency
      await windowManager.cleanupClosedWindows()

      // Check for reasonable window counts
      const windowInfo = await windowManager.getAllWindowInfo()
      if (windowInfo.length === 0) {
        warnings.push('No windows detected')
        score -= 10
      }

    } catch (error) {
      errors.push(`Window manager check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      score -= 50
    }

    return {
      name: 'Window Manager',
      status: this.determineComponentStatus(score),
      score,
      errors,
      warnings,
      lastCheck: Date.now()
    }
  }

  private async checkScreenshotManagerHealth(): Promise<ComponentHealth> {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    try {
      // Check screenshot statistics
      const stats = await screenshotManager.getScreenshotStats()
      
      if (stats.totalSize > 10 * 1024 * 1024) { // 10MB
        warnings.push(`Large screenshot cache: ${Math.round(stats.totalSize / 1024 / 1024)}MB`)
        score -= 10
      }

      if (stats.cacheHitRatio < 0.5) {
        warnings.push(`Low cache hit ratio: ${Math.round(stats.cacheHitRatio * 100)}%`)
        score -= 5
      }

    } catch (error) {
      errors.push(`Screenshot manager check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      score -= 50
    }

    return {
      name: 'Screenshot Manager',
      status: this.determineComponentStatus(score),
      score,
      errors,
      warnings,
      lastCheck: Date.now()
    }
  }

  private async checkHarpoonManagerHealth(): Promise<ComponentHealth> {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    try {
      // Validate harpoon tabs
      const validation = await harpoonManager.validateAndCleanupHarpoonTabs()
      
      if (validation.removedCount > 0) {
        warnings.push(`Removed ${validation.removedCount} invalid harpoon tabs`)
        score -= 5
      }

      // Check harpoon statistics
      const stats = harpoonManager.getHarpoonStats()
      if (stats.totalTabs > harpoonManager.getMaxHarpoonTabs()) {
        warnings.push('Harpoon tab count exceeds maximum')
        score -= 10
      }

    } catch (error) {
      errors.push(`Harpoon manager check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      score -= 50
    }

    return {
      name: 'Harpoon Manager',
      status: this.determineComponentStatus(score),
      score,
      errors,
      warnings,
      lastCheck: Date.now()
    }
  }

  private determineComponentStatus(score: number): HealthStatus {
    if (score >= 90) return 'healthy'
    if (score >= 70) return 'degraded'
    if (score >= 50) return 'critical'
    return 'critical'
  }

  private determineOverallStatus(components: ComponentHealth[], overallScore: number): HealthStatus {
    const criticalComponents = components.filter(c => c.status === 'critical')
    
    if (criticalComponents.length > 0) return 'critical'
    if (overallScore >= 90) return 'healthy'
    if (overallScore >= 70) return 'degraded'
    return 'critical'
  }

  private generateRecommendations(components: ComponentHealth[]): string[] {
    const recommendations: string[] = []

    for (const component of components) {
      if (component.status === 'critical') {
        recommendations.push(`Critical issue in ${component.name}: ${component.errors.join(', ')}`)
      } else if (component.status === 'degraded') {
        recommendations.push(`Performance issue in ${component.name}: ${component.warnings.join(', ')}`)
      }
    }

    return recommendations
  }

  private async updateSystemHealth(healthResult: HealthCheckResult): Promise<void> {
    try {
      await stateManager.updateSystemHealth({
        lastHealthCheck: healthResult.timestamp
      })
    } catch (error) {
      serviceWorkerLogger.error('Failed to update system health:', error)
    }
  }

  private async createRecoveryPlan(): Promise<RecoveryPlan> {
    const actions: RecoveryAction[] = []

    // Add cleanup actions
    actions.push({
      type: 'cleanup',
      component: 'screenshots',
      description: 'Clean up old screenshots',
      priority: 'medium',
      automated: true
    })

    actions.push({
      type: 'cleanup',
      component: 'tabs',
      description: 'Remove invalid tabs',
      priority: 'high',
      automated: true
    })

    // Add reset actions if needed
    if (this.lastHealthCheck?.status === 'critical') {
      actions.push({
        type: 'reset',
        component: 'state',
        description: 'Reset corrupted state',
        priority: 'high',
        automated: false
      })
    }

    return {
      actions,
      estimatedTime: actions.length * 5000, // 5 seconds per action
      riskLevel: actions.some(a => a.type === 'reset') ? 'high' : 'medium',
      requiresUserConsent: actions.some(a => !a.automated)
    }
  }

  private async executeRecoveryPlan(plan: RecoveryPlan): Promise<boolean> {
    try {
      for (const action of plan.actions) {
        serviceWorkerLogger.info(`Executing recovery action: ${action.description}`)
        
        switch (action.type) {
          case 'cleanup':
            await this.executeCleanupAction(action)
            break
          case 'reset':
            await this.executeResetAction(action)
            break
          case 'repair':
            await this.executeRepairAction(action)
            break
          case 'fallback':
            await this.executeFallbackAction(action)
            break
        }
      }

      return true
    } catch (error) {
      serviceWorkerLogger.error('Recovery plan execution failed:', error)
      return false
    }
  }

  private async executeCleanupAction(action: RecoveryAction): Promise<void> {
    switch (action.component) {
      case 'screenshots':
        await screenshotManager.cleanupScreenshots()
        break
      case 'tabs':
        await tabManager.cleanupInvalidTabs()
        break
      case 'windows':
        await windowManager.cleanupClosedWindows()
        break
    }
  }

  private async executeResetAction(action: RecoveryAction): Promise<void> {
    switch (action.component) {
      case 'state':
        // Reset to minimal state
        await stateManager.updateTabHistory({ type: 'reorder', tabs: [] })
        await harpoonManager.clearAllHarpoonTabs()
        break
    }
  }

  private async executeRepairAction(action: RecoveryAction): Promise<void> {
    // Implement repair actions as needed
    serviceWorkerLogger.info(`Repair action for ${action.component}`)
  }

  private async executeFallbackAction(action: RecoveryAction): Promise<void> {
    // Implement fallback actions as needed
    serviceWorkerLogger.info(`Fallback action for ${action.component}`)
  }

  private async clearVolatileData(): Promise<void> {
    // Clear caches and temporary data
    messageBroker.clearQueue()
    // Could clear other volatile data as needed
  }

  private reduceSystemActivity(): void {
    // Reduce polling and background activity
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
  }

  private restoreSystemActivity(): void {
    // Restore normal activity
    this.scheduleHealthCheck()
  }

  /**
   * Cleanup on destruction
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }
}

// Export singleton instance
export const recoveryManager = new RecoveryManager()