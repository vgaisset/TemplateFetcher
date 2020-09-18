import * as vscode from 'vscode';

import * as logger from './logger'
import fetchTemplateCmd from './templateFetching'
import newTemplateCmd from './templateCreation'
import deleteTemplateCmd from './templateDeletion'
import * as cache from './templateCaching'

export function activate(context: vscode.ExtensionContext) {
	logger.init()

	context.subscriptions.push(
		vscode.commands.registerCommand('templatefetcher.fetch', fetchTemplateCmd)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('templatefetcher.newTemplate', newTemplateCmd)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('templatefetcher.deleteTemplate', deleteTemplateCmd)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('templatefetcher.setCacheDirectory', cache.setCacheDirectoryCmd)
	);
}
