import * as vscode from 'vscode'
import { LoggerService } from '../domain/services/loggerService'

let channel: vscode.OutputChannel

export function init(channelName = "Template Fetcher") {
    channel = vscode.window.createOutputChannel(channelName)
}

export class VscodeLoggerService implements LoggerService {
    prefix: string

    constructor(prefix = "") {
        this.prefix = prefix
    }
    
    async log(msg: string) {
        channel.appendLine(`[Template Fetcher] ${this.prefix} ${msg}`)
    }
    
    async info(msg: string) {
        this.log(`Info: ${msg}`)
    }
    
    async warning(msg: string) {
        this.log(`Warning: ${msg}`)
    }
    
    async error(msg: string) {
        this.log(`Error: ${msg}`)
    }

    async flush() {
        channel.show(false)
    }
}

