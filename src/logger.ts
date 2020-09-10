import * as vscode from 'vscode'

let channel: vscode.OutputChannel

export function init(channelName = "Template Fetcher") {
    channel = vscode.window.createOutputChannel(channelName)
}

export class Logger {
    prefix: string

    constructor(prefix = "") {
        this.prefix = prefix
    }
    
    log(msg: string) {
        channel.appendLine(`[Template Fetcher] ${this.prefix} ${msg}`)
        channel.show()
    }
    
    info(msg: string) {
        this.log(`Info: ${msg}`)
    }
    
    warning(msg: string) {
        this.log(`Warning: ${msg}`)
    }
    
    error(msg: string) {
        this.log(`Error: ${msg}`)
    }
}

