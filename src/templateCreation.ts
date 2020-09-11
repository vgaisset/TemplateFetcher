import * as vscode from 'vscode'
import * as config from './config'

enum TemplateType {
    FILE,
    DIRECTORY,
    ARCHIVE,
}

export default function newTemplateCommand(): void {
    openTemplateCreationDialog().then(newTemplate => {
        if(newTemplate) {
            config.createOrUpdateTemplateInfo(newTemplate)
            vscode.window.showInformationMessage(`The '${newTemplate.name}' template has been successfully added !`)
        } else {
            vscode.window.showErrorMessage('The template creation has been cancelled')
        }
    })
}

export async function openTemplateCreationDialog(): Promise<config.TemplateInfo | undefined> {
    const name = await openTemplateNameDialog()

    if(name === undefined) {
        return new Promise((ok, _) => { ok(undefined) })
    }
    
    const templateType = await openTemplateTypeDialog()
    if(templateType === undefined) {
        return new Promise((ok, _) => { ok(undefined) })
    }

    const uri = await openUriDialog(templateType)
    if(uri === undefined) {
        return new Promise((ok, _) => { ok(undefined) })
    }

    const directoryDepth = await openDirectoryDepthDialog(templateType)
    if(directoryDepth === undefined) {
        return new Promise((ok, _) =>  { ok(undefined) })
    }

    return new Promise((ok, _) => {
        ok({
            name: name,
            uri: uri,
            directoryDepth: directoryDepth,
            isArchive: templateType === TemplateType.ARCHIVE
        })
    })
} 

async function openTemplateNameDialog(): Promise<string | undefined> {
    while(true) {
        const name = await vscode.window.showInputBox({placeHolder: 'Enter your template name'})

        if(name && config.getTemplatesInfo().has(name)) {
            vscode.window.showErrorMessage(`The template '${name}' already exist`)
        } else if(name?.length === 0) {
            vscode.window.showErrorMessage(`A template name can not be empty`)
        } else {
            return new Promise((ok, _) => { ok(name) })
        }
    }
}

async function openTemplateTypeDialog(): Promise<TemplateType | undefined> {
    const directoryType = 'Directory'
    const fileType = 'File'
    const archiveType = 'Archive'

    const templateTypeStr = await vscode.window.showQuickPick([directoryType, fileType, archiveType], {
        placeHolder: 'What is your template type ?'
    })

    let templateType: TemplateType | undefined

    switch(templateTypeStr) {
        case directoryType: {
            templateType = TemplateType.DIRECTORY
            break
        }
        case fileType: {
            templateType = TemplateType.FILE
            break
        }
        case archiveType: {
            templateType = TemplateType.ARCHIVE
            break
        }
        default: {
            templateType = undefined
            break;
        }
    }

    return new Promise((ok, _) => { ok(templateType) })
}

async function openUriDialog(templateType: TemplateType): Promise<string | undefined> {
    const uriFromFs = 'From file system...'
    const uriFromText = 'From URI...'

    const uriInputType = await vscode.window.showQuickPick([uriFromFs, uriFromText], {placeHolder: 'From where to fetch your template ?'})

    if(uriInputType === undefined) {
        return new Promise((ok, _) => { ok(undefined) })
    }

    if(uriInputType === uriFromFs) {
        const vsCodeUri = await vscode.window.showOpenDialog({
            canSelectFiles: templateType === TemplateType.FILE || templateType === TemplateType.ARCHIVE,
            canSelectFolders: templateType === TemplateType.DIRECTORY,
            canSelectMany: false,
            title: 'Select your template'
        })
        return new Promise((ok, _) => { ok(vsCodeUri ? vsCodeUri[0].fsPath : undefined) })
    } else {
        while(true) {
            const uri = await vscode.window.showInputBox({placeHolder: 'Enter a non empty URI'})
    
            if(uri && uri.length === 0){ 
                vscode.window.showErrorMessage('An URI can not be empty')
            } else {
                return new Promise((ok, _) => { ok(uri) })
            }
        }
    }
}

async function openDirectoryDepthDialog(templateType: TemplateType): Promise<number | undefined> {
    if(templateType === TemplateType.FILE) {
        return new Promise((ok, _) => { ok(0) })
    }

    while(true) {
        const numberStr = await vscode.window.showInputBox({value: '0', prompt: 'How many leading directories must be discarded ?'})
        if(numberStr === undefined) {
            return new Promise((ok, _) => { ok(undefined) })
        }
        
        const number = Number(numberStr)

        if(Number.isNaN(number) || number < 0 || !Number.isInteger(number)) {
            vscode.window.showErrorMessage('The directory depth must be a positive integer. It indicates how many leading directories must be discarded')
        } else {
            return new Promise((ok, _) => { ok(number) })
        }
    }
}