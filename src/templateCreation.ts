import * as vscode from 'vscode'
import * as config from './config'
import * as dialogs from './dialogs'

export enum TemplateType {
    FILE,
    DIRECTORY,
    ARCHIVE,
}

export const DEFAULT_DISCARDED_LEADING_DIRECTORIES = 1

export default async function newTemplateCommand() {
    const newTemplate = await dialogs.newTemplate()

    if(newTemplate) {
        config.createOrUpdateTemplate(newTemplate)
        vscode.window.showInformationMessage(`The '${newTemplate.name}' template has been successfully added !`)
    } else {
        vscode.window.showErrorMessage('The template creation has been cancelled')
    }
}
