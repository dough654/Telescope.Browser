import { serviceWorkerLogger } from '../../utils/logger.js'
import { canReceiveMessages } from '../../utils/tab-filters.js'

export interface Message {
  id: string
  type: string
  payload: unknown
  timestamp: number
  priority: MessagePriority
  retryCount: number
  maxRetries: number
  timeout: number
}

export type MessagePriority = 'high' | 'medium' | 'low'

export interface MessageDeliveryResult {
  success: boolean
  error?: string
  response?: unknown
}

export interface MessageTransaction {
  id: string
  messages: QueuedMessage[]
  committed: boolean
  rolledBack: boolean
}

interface QueuedMessage {
  message: Message
  tabId?: number
  windowId?: number
  broadcast: boolean
}

/**
 * Reliable message broker with delivery guarantees
 */
export class MessageBroker {
  private messageQueue: QueuedMessage[] = []
  private activeTransactions = new Map<string, MessageTransaction>()
  private transactionCounter = 0
  private messageCounter = 0
  private processingQueue = false
  private retryTimeouts = new Map<string, NodeJS.Timeout>()
  private maxQueueSize = 1000 // Maximum queued messages
  private maxActiveTransactions = 100 // Maximum concurrent transactions
  private maxRetryTimeouts = 500 // Maximum retry timeouts

  constructor() {
    // Start processing queue
    this.startQueueProcessor()
  }

  /**
   * Send message to specific tab with retry logic
   */
  async sendMessage(tabId: number, type: string, payload: unknown, options: {
    priority?: MessagePriority
    maxRetries?: number
    timeout?: number
  } = {}): Promise<MessageDeliveryResult> {
    const message = this.createMessage(type, payload, options)
    
    return this.sendMessageWithRetry(tabId, message)
  }

  /**
   * Broadcast message to all tabs
   */
  async broadcastToAllTabs(type: string, payload: unknown, options: {
    priority?: MessagePriority
    maxRetries?: number
    timeout?: number
  } = {}): Promise<MessageDeliveryResult[]> {
    // Use faster defaults for broadcast notifications
    const broadcastOptions = {
      priority: options.priority || 'medium',
      maxRetries: options.maxRetries || 1, // Reduced from 3 to 1
      timeout: options.timeout || 1000 // Reduced from 5000ms to 1000ms
    }
    
    const message = this.createMessage(type, payload, broadcastOptions)
    
    try {
      const tabs = await this.getEligibleTabs()
      
      // Send messages in parallel instead of sequential
      const messagePromises = tabs.map(async (tab) => {
        try {
          return await this.sendMessageWithRetry(tab.id!, message)
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
      
      const results = await Promise.allSettled(messagePromises)
      const finalResults = results.map(result => 
        result.status === 'fulfilled' ? result.value : {
          success: false,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
        }
      )
      
      const successCount = finalResults.filter(r => r.success).length
      serviceWorkerLogger.debug(`Broadcast completed: ${successCount}/${tabs.length} tabs reached`)
      
      return finalResults
    } catch (error) {
      serviceWorkerLogger.error('Broadcast failed:', error)
      throw error
    }
  }

  /**
   * Broadcast message to specific window
   */
  async broadcastToWindow(windowId: number, type: string, payload: unknown, options: {
    priority?: MessagePriority
    maxRetries?: number
    timeout?: number
  } = {}): Promise<MessageDeliveryResult[]> {
    const message = this.createMessage(type, payload, options)
    
    try {
      const tabs = await this.getTabsInWindow(windowId)
      const results: MessageDeliveryResult[] = []
      
      for (const tab of tabs) {
        try {
          const result = await this.sendMessageWithRetry(tab.id!, message)
          results.push(result)
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      const successCount = results.filter(r => r.success).length
      serviceWorkerLogger.debug(`Window broadcast completed: ${successCount}/${tabs.length} tabs reached`)
      
      return results
    } catch (error) {
      serviceWorkerLogger.error('Window broadcast failed:', error)
      throw error
    }
  }

  /**
   * Begin a message transaction
   */
  beginTransaction(): MessageTransaction {
    // Enforce active transaction limit
    if (this.activeTransactions.size >= this.maxActiveTransactions) {
      serviceWorkerLogger.warn(`Too many active transactions (${this.maxActiveTransactions}), cleaning up oldest`)
      this.cleanupOldTransactions()
    }

    const id = `msg_tx_${++this.transactionCounter}_${Date.now()}`
    const transaction: MessageTransaction = {
      id,
      messages: [],
      committed: false,
      rolledBack: false
    }
    
    this.activeTransactions.set(id, transaction)
    serviceWorkerLogger.debug(`Message transaction ${id} started`)
    return transaction
  }

  /**
   * Add message to transaction
   */
  addToTransaction(
    tx: MessageTransaction,
    type: string,
    payload: unknown,
    target: { tabId?: number; windowId?: number; broadcast?: boolean },
    options: {
      priority?: MessagePriority
      maxRetries?: number
      timeout?: number
    } = {}
  ): void {
    if (tx.committed || tx.rolledBack) {
      throw new Error(`Transaction ${tx.id} is no longer active`)
    }

    const message = this.createMessage(type, payload, options)
    
    tx.messages.push({
      message,
      tabId: target.tabId,
      windowId: target.windowId,
      broadcast: target.broadcast || false
    })
    
    serviceWorkerLogger.debug(`Message added to transaction ${tx.id}`)
  }

  /**
   * Commit transaction (send all messages)
   */
  async commitTransaction(tx: MessageTransaction): Promise<MessageDeliveryResult[]> {
    if (tx.committed || tx.rolledBack) {
      throw new Error(`Transaction ${tx.id} is no longer active`)
    }

    try {
      const results: MessageDeliveryResult[] = []
      
      for (const queuedMessage of tx.messages) {
        if (queuedMessage.broadcast) {
          const broadcastResults = await this.broadcastToAllTabs(
            queuedMessage.message.type,
            queuedMessage.message.payload,
            {
              priority: queuedMessage.message.priority,
              maxRetries: queuedMessage.message.maxRetries,
              timeout: queuedMessage.message.timeout
            }
          )
          results.push(...broadcastResults)
        } else if (queuedMessage.windowId) {
          const windowResults = await this.broadcastToWindow(
            queuedMessage.windowId,
            queuedMessage.message.type,
            queuedMessage.message.payload,
            {
              priority: queuedMessage.message.priority,
              maxRetries: queuedMessage.message.maxRetries,
              timeout: queuedMessage.message.timeout
            }
          )
          results.push(...windowResults)
        } else if (queuedMessage.tabId) {
          const result = await this.sendMessage(
            queuedMessage.tabId,
            queuedMessage.message.type,
            queuedMessage.message.payload,
            {
              priority: queuedMessage.message.priority,
              maxRetries: queuedMessage.message.maxRetries,
              timeout: queuedMessage.message.timeout
            }
          )
          results.push(result)
        }
      }
      
      tx.committed = true
      this.activeTransactions.delete(tx.id)
      
      serviceWorkerLogger.debug(`Transaction ${tx.id} committed successfully`)
      return results
    } catch (error) {
      serviceWorkerLogger.error(`Transaction ${tx.id} commit failed:`, error)
      throw error
    }
  }

  /**
   * Rollback transaction (discard all messages)
   */
  async rollbackTransaction(tx: MessageTransaction): Promise<void> {
    if (tx.committed || tx.rolledBack) {
      throw new Error(`Transaction ${tx.id} is no longer active`)
    }

    tx.rolledBack = true
    this.activeTransactions.delete(tx.id)
    
    serviceWorkerLogger.debug(`Transaction ${tx.id} rolled back`)
  }

  /**
   * Execute messages within a transaction
   */
  async withTransaction<T>(
    fn: (tx: MessageTransaction) => Promise<T>
  ): Promise<{ result: T; deliveryResults: MessageDeliveryResult[] }> {
    const tx = this.beginTransaction()
    
    try {
      const result = await fn(tx)
      const deliveryResults = await this.commitTransaction(tx)
      return { result, deliveryResults }
    } catch (error) {
      await this.rollbackTransaction(tx)
      throw error
    }
  }

  /**
   * Add message to queue for processing
   */
  enqueueMessage(message: Message, tabId?: number, windowId?: number, broadcast = false): void {
    // Enforce queue size limit
    if (this.messageQueue.length >= this.maxQueueSize) {
      serviceWorkerLogger.warn(`Message queue full (${this.maxQueueSize}), dropping oldest message`)
      this.messageQueue.shift() // Remove oldest message
    }

    this.messageQueue.push({
      message,
      tabId,
      windowId,
      broadcast
    })
    
    // Start processing if not already running
    if (!this.processingQueue) {
      this.processQueue()
    }
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    this.messageQueue = []
    serviceWorkerLogger.info('Message queue cleared')
  }

  /**
   * Clean up old transactions that may have been orphaned
   */
  private cleanupOldTransactions(): void {
    const cutoffTime = Date.now() - (10 * 60 * 1000) // 10 minutes old
    let removedCount = 0

    for (const [id, transaction] of this.activeTransactions.entries()) {
      // Extract timestamp from transaction ID format: msg_tx_${counter}_${timestamp}
      const timestampStr = id.split('_').pop()
      if (timestampStr) {
        const timestamp = parseInt(timestampStr)
        if (timestamp < cutoffTime) {
          this.activeTransactions.delete(id)
          removedCount++
        }
      }
    }

    if (removedCount > 0) {
      serviceWorkerLogger.debug(`Cleaned up ${removedCount} old transactions`)
    }
  }

  /**
   * Clean up old retry timeouts
   */
  private cleanupRetryTimeouts(): void {
    if (this.retryTimeouts.size <= this.maxRetryTimeouts) {
      return
    }

    // Clear all retry timeouts and start fresh if we have too many
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout)
    }
    this.retryTimeouts.clear()
    
    serviceWorkerLogger.warn(`Cleared all retry timeouts due to excessive count (${this.retryTimeouts.size})`)
  }

  // Private methods

  private createMessage(type: string, payload: unknown, options: {
    priority?: MessagePriority
    maxRetries?: number
    timeout?: number
  } = {}): Message {
    return {
      id: `msg_${++this.messageCounter}_${Date.now()}`,
      type,
      payload,
      timestamp: Date.now(),
      priority: options.priority || 'medium',
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 5000
    }
  }

  private async sendMessageWithRetry(tabId: number, message: Message): Promise<MessageDeliveryResult> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= message.maxRetries; attempt++) {
      try {
        const result = await this.sendSingleMessage(tabId, message)
        
        if (result.success) {
          return result
        }
        
        lastError = new Error(result.error || 'Unknown error')
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < message.maxRetries) {
        const delay = Math.pow(2, attempt) * 100
        await this.delay(delay)
      }
    }
    
    return {
      success: false,
      error: lastError?.message || 'Max retries exceeded'
    }
  }

  private async sendSingleMessage(tabId: number, message: Message): Promise<MessageDeliveryResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: 'Timeout'
        })
      }, message.timeout)

      chrome.tabs.sendMessage(tabId, {
        message: message.type,
        messageId: message.id,
        ...message.payload as Record<string, unknown>
      }, (response) => {
        clearTimeout(timeout)
        
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          })
        } else {
          resolve({
            success: true,
            response
          })
        }
      })
    })
  }

  private async getEligibleTabs(): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        const eligibleTabs = tabs.filter(canReceiveMessages)
        resolve(eligibleTabs)
      })
    })
  }

  private async getTabsInWindow(windowId: number): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) => {
      chrome.tabs.query({ windowId }, (tabs) => {
        const eligibleTabs = tabs.filter(canReceiveMessages)
        resolve(eligibleTabs)
      })
    })
  }

  private startQueueProcessor(): void {
    // Process queue every 100ms
    setInterval(() => {
      if (!this.processingQueue && this.messageQueue.length > 0) {
        this.processQueue()
      }
    }, 100)
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue) {
      return
    }

    this.processingQueue = true
    
    try {
      // Sort by priority
      this.messageQueue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.message.priority] - priorityOrder[a.message.priority]
      })

      // Process messages
      while (this.messageQueue.length > 0) {
        const queuedMessage = this.messageQueue.shift()!
        
        try {
          if (queuedMessage.broadcast) {
            await this.broadcastToAllTabs(
              queuedMessage.message.type,
              queuedMessage.message.payload,
              {
                priority: queuedMessage.message.priority,
                maxRetries: queuedMessage.message.maxRetries,
                timeout: queuedMessage.message.timeout
              }
            )
          } else if (queuedMessage.windowId) {
            await this.broadcastToWindow(
              queuedMessage.windowId,
              queuedMessage.message.type,
              queuedMessage.message.payload,
              {
                priority: queuedMessage.message.priority,
                maxRetries: queuedMessage.message.maxRetries,
                timeout: queuedMessage.message.timeout
              }
            )
          } else if (queuedMessage.tabId) {
            await this.sendMessage(
              queuedMessage.tabId,
              queuedMessage.message.type,
              queuedMessage.message.payload,
              {
                priority: queuedMessage.message.priority,
                maxRetries: queuedMessage.message.maxRetries,
                timeout: queuedMessage.message.timeout
              }
            )
          }
        } catch (error) {
          serviceWorkerLogger.error('Failed to process queued message:', error)
        }
      }
    } finally {
      this.processingQueue = false
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const messageBroker = new MessageBroker()