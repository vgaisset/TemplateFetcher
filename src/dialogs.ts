import * as vscode from 'vscode'
import * as config from './config'
import * as tools from './tools'
import { DEFAULT_DISCARDED_LEADING_DIRECTORIES, TemplateType } from './templateCreation'
import { Template } from './Template'

interface SelectTemplateDialogOptions {
    placeHolder?: string
    filter?: (template: Template) => boolean
}
export async function selectTemplate({placeHolder = 'Select a template', filter = undefined}: SelectTemplateDialogOptions): Promise<Template | undefined> {
    const selection = config.getTemplates()

    for(const err of selection.invalidTemplateErrors) {
        vscode.window.showErrorMessage(err)
    }

    if(filter) {
        for(const [name, template] of selection.validTemplates) {
            if(!filter(template)) {
                selection.validTemplates.delete(name)
            }
        }
    }

    const templateNames = Array.from(selection.validTemplates.keys())
    if(templateNames.length === 0) {
        placeHolder = 'No template to show off'
    }

    const templateName = await vscode.window.showQuickPick(templateNames, {placeHolder: placeHolder})

    return templateName ? selection.validTemplates.get(templateName) : undefined
}

export async function newTemplate(): Promise<Template | undefined> {
    const name = await askTemplateName()

    if(name === undefined) {
        return new Promise((ok, _) => { ok(undefined) })
    }
    
    const templateType = await askTemplateType()
    if(templateType === undefined) {
        return new Promise((ok, _) => { ok(undefined) })
    }

    const uri = await askURI(templateType)
    if(uri === undefined) {
        return new Promise((ok, _) => { ok(undefined) })
    }

    const discardedLeadingDirectories = await askDiscardedLeadingDirectories(templateType)
    if(discardedLeadingDirectories === undefined) {
        return new Promise((ok, _) =>  { ok(undefined) })
    }

    return {
        name: name,
        uri: uri,
        discardedLeadingDirectories: discardedLeadingDirectories,
        isArchive: templateType === TemplateType.ARCHIVE,
        cacheName: '' // TODO: Ask for cache when creating template
    } as Template // TODO: tmp
} 

export async function askTemplateName(): Promise<string | undefined> {
    while(true) {
        const name = await vscode.window.showInputBox({placeHolder: 'Enter your template name'})

        if(name && config.getTemplates().validTemplates.has(name)) {
            vscode.window.showErrorMessage(`The template '${name}' already exist`)
        } else if(name?.length === 0) {
            vscode.window.showErrorMessage(`A template name can not be empty`)
        } else {
            return new Promise((ok, _) => { ok(name) })
        }
    }
}

export async function askTemplateType(): Promise<TemplateType | undefined> {
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

export async function askURI(templateType: TemplateType): Promise<string | undefined> {
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
            } else if(uri && tools.getUriProtocol(uri) === 'unsupported') {
                vscode.window.showErrorMessage('The used protocol is not supported (file, ftp, http and https are supported)')
            } else {
                return new Promise((ok, _) => { ok(uri) })
            }
        }
    }
}

export async function askDiscardedLeadingDirectories(templateType: TemplateType): Promise<number | undefined> {
    if(templateType === TemplateType.FILE) {
        return new Promise((ok, _) => { ok(0) })
    }

    while(true) {
        const numberStr = await vscode.window.showInputBox({
            placeHolder: 'How many leading directories must be discarded ? (default is 1)'
        })
        if(numberStr === undefined) {
            return new Promise((ok, _) => { ok(undefined) })
        }
        
        const number = numberStr === '' ? DEFAULT_DISCARDED_LEADING_DIRECTORIES : Number(numberStr)

        if(Number.isNaN(number) || number < 0 || !Number.isInteger(number)) {
            vscode.window.showErrorMessage('The directory depth must be a positive integer. It indicates how many leading directories must be discarded')
        } else {
            return new Promise((ok, _) => { ok(number) })
        }
    }
}

export async function confirmDirectoryDepth(directoryDepth: number): Promise<number> {
    while(true) {
        const numberStr = await vscode.window.showInputBox({value: `${directoryDepth}`, prompt: 'How many leading directories must be discarded ?'})
        if(numberStr === undefined) {
            return directoryDepth
        }

        const number = Number(numberStr)

        if(Number.isNaN(number) || number < 0 || !Number.isInteger(number)) {
            vscode.window.showErrorMessage('The directory depth must be a positive integer. It indicates how many leading directories must be discarded')
        } else {
            return number
        }
    }
}