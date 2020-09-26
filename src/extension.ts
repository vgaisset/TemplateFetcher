import * as vscode from 'vscode';

import * as loggerService from './services/VscodeLoggerService'
import fetchTemplateCmd from './templateFetching'
import newTemplateCmd from './templateCreation'
import deleteTemplateCmd from './templateDeletion'
import * as cache from './templateCaching'

export function activate(context: vscode.ExtensionContext) {
	loggerService.init()

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
		vscode.commands.registerCommand('templatefetcher.setCachePath', cache.setCacheDirectoryCmd)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('templatefetcher.newTemplateCache', cache.newTemplateCacheCmd)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('templatefetcher.deleteTemplateCache', cache.deleteTemplateCacheCmd)
	);
}
