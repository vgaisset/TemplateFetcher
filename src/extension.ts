import * as vscode from 'vscode';

import * as logger from './logger'
import fetchCmd from './fetcher'
import newTemplateCmd from './templateCreation'

export function activate(context: vscode.ExtensionContext) {
	logger.init()

	context.subscriptions.push(
		vscode.commands.registerCommand('templatefetcher.fetch', fetchCmd)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('templatefetcher.newTemplate', newTemplateCmd)
	);
}
