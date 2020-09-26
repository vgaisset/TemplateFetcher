import * as vscode from 'vscode'

import { VscodeLoggerService } from './services/VscodeLoggerService'
import * as config from './config'
import * as dialogs from './dialogs'
import { VscodeFetchService } from './services/VscodeFetchService'
import { fstat } from 'fs'

const logger = new VscodeLoggerService('[Fetcher]')
const fetchService = new VscodeFetchService(logger)

/**
 * Fetch command.
 * It asks to user the template to fetch and then fetchs it.
 * @param target Where to fetch the template in
 */
export default async function fetchCmd(target: vscode.Uri) {
    if(target === undefined) {
        const workspacesFolder = vscode.workspace.workspaceFolders

        if(workspacesFolder) {
            target = workspacesFolder[0].uri
        } else {
            await vscode.window.showErrorMessage('No target directory is provided and there is no open workspace')
        }
        logger.warning(`No target directory is specified, going to use '${target.fsPath}' instead`)
    }

    if(await checkForInvalidTemplates()) 
        return
    
    const template = await dialogs.selectTemplate({
        placeHolder: 'Select a template to fetch'
    })

    if(template) {        
        logger.flush()
        await fetchService.fetch(template, target.fsPath)
        return
    }
}

async function checkForInvalidTemplates(): Promise<boolean> {
    const selection = config.getTemplates()
    if(selection.validTemplates.size === 0) {
        let value: string | undefined
        if(selection.invalidTemplateErrors.length != 0) {
            value = await vscode.window.showErrorMessage('There are no valid templates', 'New template', 'Edit templates')
        } else {
            value = await vscode.window.showErrorMessage('There are no templates defined', 'New template')
        }

        if(value === 'New template') {
            vscode.commands.executeCommand('templatefetcher.newTemplate')
        } else if(value == 'Edit templates') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'templatefetcher.templates')
        }
        return true
    }
    return false
}