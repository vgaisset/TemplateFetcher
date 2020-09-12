import * as vscode from 'vscode'
import * as dialogs from './dialogs'
import * as config from './config'

export default async function templateDeletionCmd() {
    const template = await dialogs.selectTemplate({placeHolder: 'Select a template to delete (can not be undone)'})

    if(template) {
        if(config.deleteTemplate(template)) {
            vscode.window.showInformationMessage(`The ${template.name} has been successfully deleted`)
        } else {
            vscode.window.showErrorMessage(`Failed to delete the '${template.name}' template (not found in user settings)`)
        }
    }
}