import * as vscode from 'vscode';

import * as logger from './logger'
import fetch from './fetcher'

export function activate(context: vscode.ExtensionContext) {
	logger.init()

	let disposable = vscode.commands.registerCommand('templatefetcher.fetch', fetch);

	context.subscriptions.push(disposable);
}
